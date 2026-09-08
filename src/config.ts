import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.CLIENT_ID ?? '',
  guildId: process.env.GUILD_ID ?? '',
  starboardChannelId: process.env.STARBOARD_CHANNEL_ID ?? '',
  starboardThreshold: Number(process.env.STARBOARD_THRESHOLD ?? 3),
  xpMin: Number(process.env.XP_PER_MESSAGE_MIN ?? 15),
  xpMax: Number(process.env.XP_PER_MESSAGE_MAX ?? 25),
  xpCooldownSec: Number(process.env.XP_COOLDOWN_SEC ?? 120),
  twitchChannel: process.env.TWITCH_CHANNEL ?? '',
  xHandle: process.env.X_HANDLE ?? 'vstalingrady',
  twitchClientId: process.env.TWITCH_CLIENT_ID ?? '',
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
  youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID ?? '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
  streamAlertChannelId: process.env.STREAM_ALERT_CHANNEL_ID ?? '',
  streamPollSec: Number(process.env.STREAM_POLL_SEC ?? 120),
  port: Number(process.env.PORT ?? 3000),
  githubSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',
  githubChannelId: process.env.GITHUB_ALERT_CHANNEL_ID ?? '',
  githubRepo: process.env.GITHUB_REPO ?? 'vstaln/gray',
  githubPollSec: Number(process.env.GITHUB_POLL_SEC ?? 300),
};

if (!config.token) console.warn('[config] DISCORD_TOKEN missing — bot will not login');
