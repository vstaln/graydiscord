# graydiscord

Dev-progress Discord bot: moderation + prestige leveling (5→1) + starboard + stream alerts + GitHub feed.

## Quick start
```bash
cp .env.example .env  # fill DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm install
npm run dev
```

## Leveling
Ranks: `0` newcomer → `5` (500 XP) → `4` (4000) → `3` (30000) → `2` (200000) → `1` (1M).
- Message XP: 5–25/msg, 60s cooldown, <4 chars ignored, repeat-spam ignored (5 min).
- Voice XP: 10/min, every 5-min tick, requires 2+ humans in channel, skips muted/deafened/bots.
- Overflow guard: XP clamped to `MAX_XP=2M`, load sanitized — never wraps to 0.

## Webhooks
- Health: `GET /health`
- GitHub: `POST /github-webhook` (HMAC `X-Hub-Signature-256`)
