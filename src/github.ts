import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmbedBuilder, type Client } from 'discord.js';
import { config } from './config.js';

// ponytail: JSON seen-set, fine for one user's feed; revisit if watching orgs with firehose volume
const seenFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'github-seen.json');
let seen = new Set<string>();
try {
  mkdirSync(dirname(seenFile), { recursive: true });
  if (existsSync(seenFile)) seen = new Set(JSON.parse(readFileSync(seenFile, 'utf8')));
} catch { seen = new Set(); }
function saveSeen() {
  try { writeFileSync(seenFile, JSON.stringify([...seen].slice(-200))); } catch {}
}

function eventEmbed(e: any): EmbedBuilder | null {
  const repo = e.repo?.name ?? 'repo';
  const base = new EmbedBuilder().setColor(0x238636).setTimestamp(new Date(e.created_at));
  if (e.type === 'PushEvent') {
    const commits = (e.payload?.commits ?? []).slice(0, 5).map((c: any) => `• ${String(c.message).split('\n')[0].slice(0, 120)}`).join('\n');
    return base.setTitle(`📦 Pushed to ${repo}`).setDescription(`${e.payload?.size ?? 0} commit(s) on ${(e.payload?.ref ?? '').replace('refs/heads/', '') || '?'}\n${commits}`.slice(0, 4000));
  }
  if (e.type === 'PullRequestEvent') return base.setTitle(`🔀 PR ${e.payload?.action} in ${repo}`).setDescription(`${e.payload?.pull_request?.title ?? ''}\n${e.payload?.pull_request?.html_url ?? ''}`.slice(0, 4000));
  if (e.type === 'IssuesEvent') return base.setTitle(`🐛 Issue ${e.payload?.action} in ${repo}`).setDescription(`${e.payload?.issue?.title ?? ''}\n${e.payload?.issue?.html_url ?? ''}`.slice(0, 4000));
  if (e.type === 'ReleaseEvent') return base.setTitle(`🚀 Released ${e.payload?.release?.tag_name ?? ''} in ${repo}`).setDescription(`${e.payload?.release?.name ?? ''}\n${e.payload?.release?.html_url ?? ''}`.slice(0, 4000));
  if (e.type === 'CreateEvent') return base.setTitle(`🌱 Created ${e.payload?.ref_type ?? ''} ${e.payload?.ref ?? ''} in ${repo}`);
  if (e.type === 'ForkEvent') return base.setTitle(`🍴 Forked ${repo}`).setDescription(`${e.payload?.forkee?.full_name ?? ''}`.slice(0, 1000));
  return null;
}

// Polls a user's public GitHub events — no public URL or webhook needed, works from home.
export function startGithubPolling(client: Client) {
  if (!config.githubUser || !config.githubChannelId) { console.log('[github] polling skipped (GITHUB_USER/CHANNEL unset)'); return; }
  const tick = async () => {
    try {
      const res = await fetch(`https://api.github.com/users/${config.githubUser}/events/public?per_page=20`, {
        headers: { 'User-Agent': 'graydiscord', Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) { console.error('[github] poll', res.status); return; }
      const evs = await res.json() as any[];
      if (!Array.isArray(evs)) return;
      const fresh = evs.filter(e => !seen.has(String(e.id)));
      if (!fresh.length) return;
      const firstRun = seen.size === 0;
      const toPost = firstRun ? [fresh[0]] : [...fresh].reverse().slice(0, 5);
      for (const e of evs) seen.add(String(e.id));
      saveSeen();
      const ch = await client.channels.fetch(config.githubChannelId).catch(() => null);
      if (!ch?.isTextBased() || !ch.isSendable()) return;
      for (const e of toPost) {
        const embed = eventEmbed(e);
        if (embed) await ch.send({ embeds: [embed] });
      }
      if (firstRun) console.log('[github] seeded history, posted latest');
    } catch (e) { console.error('[github] poll', e); }
  };
  setInterval(tick, Math.max(60, config.githubPollSec) * 1000);
  setTimeout(tick, 15_000);
}

export function startGithubWebhook(client: Client) {
  if (!config.githubSecret && !config.githubChannelId) return;
  const app = express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }) as any;
  const server = express();
  server.use(express.json({
    verify: (req: any, _res, buf) => { (req as any).rawBody = buf; },
  }));

  server.get('/health', (_req, res) => res.json({ ok: true }));
  void app;

  server.post('/github-webhook', async (req, res) => {
    try {
      const sig = req.header('X-Hub-Signature-256') ?? '';
      const raw = (req as any).rawBody as Buffer;
      if (config.githubSecret && raw) {
        const expect = 'sha256=' + createHmac('sha256', config.githubSecret).update(raw).digest('hex');
        const ok = sig.length === expect.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
        if (!ok) { res.status(401).send('bad sig'); return; }
      }
      const event = req.header('X-GitHub-Event') ?? 'push';
      const chId = config.githubChannelId || config.githubSecret && '';
      const target = chId ? await client.channels.fetch(String(chId)).catch(() => null) : null;
      if (target?.isTextBased() && target.isSendable()) {
        const repo = (req.body?.repository?.full_name) ?? 'repo';
        const embed = new EmbedBuilder().setColor(0x238636).setTitle(`GitHub: ${event} on ${repo}`).setTimestamp(new Date());
        if (event === 'push') {
          const commits = (req.body?.commits ?? []).slice(0, 5).map((c: any) => `• ${String(c.message).split('\n')[0].slice(0, 120)} — ${c.author?.name ?? c.author?.username ?? ''}`).join('\n');
          embed.setDescription(commits.slice(0, 4000) || 'push');
        } else if (event === 'pull_request') {
          embed.setDescription(`PR #${req.body?.number} ${req.body?.action}: ${req.body?.pull_request?.title ?? ''}\n${req.body?.pull_request?.html_url ?? ''}`.slice(0, 4000));
        } else if (event === 'issues') {
          embed.setDescription(`Issue #${req.body?.issue?.number} ${req.body?.action}: ${req.body?.issue?.title ?? ''}`.slice(0, 4000));
        } else if (event === 'release') {
          embed.setDescription(`Release ${req.body?.release?.tag_name ?? ''}: ${req.body?.release?.name ?? ''}`.slice(0, 4000));
        } else {
          embed.setDescription(String(req.body?.action ?? event).slice(0, 2000));
        }
        await target.send({ embeds: [embed] });
      }
      res.send('ok');
    } catch (e) { console.error('[github]', e); res.status(500).send('err'); }
  });

  server.listen(config.port, () => console.log(`[github] webhook on :${config.port}`));
}
