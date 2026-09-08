import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { EmbedBuilder, type Client } from 'discord.js';
import { config } from './config.js';

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
