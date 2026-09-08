import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { config } from './config.js';

// Simulcast: same stream on Twitch + YouTube + X. Whichever fires first,
// one white alert links all three. Cooldown stops re-pings for the same stream.
const ALERT_COOLDOWN = 6 * 3600_000;
let lastAlert = 0;

export function liveLinks() {
  return {
    twitch: `https://twitch.tv/${config.twitchChannel || 'vstaln'}`,
    youtube: 'https://www.youtube.com/@vstalingrady/live',
    x: `https://x.com/${config.xHandle || 'vstalingrady'}`,
  };
}

export function buildLiveEmbed(title?: string): EmbedBuilder {
  const l = liveLinks();
  return new EmbedBuilder().setColor(0xffffff)
    .setTitle('🔴 vstaln is LIVE')
    .setDescription(`${title ?? 'Same stream everywhere:'}\n🟣 [Twitch](${l.twitch})\n🔴 [YouTube](${l.youtube})\n⬛ [X](${l.x})`);
}

async function announceLive(ch: TextChannel, title?: string) {
  if (Date.now() - lastAlert < ALERT_COOLDOWN) return;
  lastAlert = Date.now();
  await ch.send({ embeds: [buildLiveEmbed(title)] });
}

// ponytail: RSS/polling first (no keys), upgrade to EventSub/webhooks if you outgrow polling
let twitchLive = false;
let ytLastId = '';

async function twitchIsLive(): Promise<{ live: boolean; title?: string } | null> {
  const { twitchChannel, twitchClientId, twitchClientSecret } = config;
  if (!twitchChannel || !twitchClientId || !twitchClientSecret) return null;
  try {
    const t = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`, { method: 'POST' }).then(r => r.json() as Promise<any>);
    const h = { 'Client-ID': twitchClientId, Authorization: `Bearer ${t.access_token}` };
    const s = await fetch(`https://api.twitch.tv/helix/streams?user_login=${twitchChannel}`, { headers: h }).then(r => r.json() as Promise<any>);
    const s0 = s.data?.[0];
    return s0 ? { live: true, title: s0.title } : { live: false };
  } catch { return null; }
}

async function ytLatest(): Promise<{ id: string; title: string; live: boolean } | null> {
  if (!config.youtubeChannelId) return null;
  try {
    const rss = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${config.youtubeChannelId}`).then(r => r.text());
    const m = rss.match(/<yt:videoId>([^<]+)<\/yt:videoId>[\s\S]*?<title>([^<]+)<\/title>/);
    if (!m) return null;
    return { id: m[1], title: m[2], live: false };
  } catch { return null; }
}

export function initStreams(client: Client) {
  if (!config.streamAlertChannelId) { console.log('[streams] no alert channel, skipping'); return; }
  const tick = async () => {
    try {
      const ch = await client.channels.fetch(config.streamAlertChannelId).catch(() => null);
      if (!ch?.isTextBased() || !ch.isSendable()) return;
      const text = ch as TextChannel;
      const tw = await twitchIsLive();
      if (tw && tw.live && !twitchLive) {
        twitchLive = true;
        await announceLive(text, tw.title);
      } else if (tw && !tw.live) twitchLive = false;
      const yt = await ytLatest();
      if (yt && ytLastId && yt.id !== ytLastId) {
        await announceLive(text, yt.title);
      }
      if (yt) ytLastId = yt.id;
    } catch (e) { console.error('[streams]', e); }
  };
  setInterval(tick, Math.max(60, config.streamPollSec) * 1000);
  setTimeout(tick, 10_000);
}
