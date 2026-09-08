# graydiscord

Dev-progress Discord bot: moderation + prestige leveling (5→1) + starboard + stream alerts + GitHub feed.

## Quick start
```bash
cp .env.example .env  # fill DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm install
npm run dev
```

## Leveling
Ranks: `0` newcomer → `5` (500 XP) → `4` (4000) → `3` (30000) → `2` (200000) → `1` (1M) → NONE.
Ladder is exponential (~6.7x per rank, tapered at top); extrapolated next would be ~6.7M — unreachable, so rank 1 is max.
- Message XP (Tatsu algo): flat random 10–20 per 2-min window, one award per window. <4 chars ignored, repeat-spam ignored (5 min).
- Voice XP: 10/min, every 5-min tick, requires 2+ humans in channel, skips muted/deafened/bots.
- Overflow guard: XP clamped to `MAX_XP=2M`, load sanitized — never wraps to 0.

## Webhooks
- Health: `GET /health`
- GitHub: `POST /github-webhook` (HMAC `X-Hub-Signature-256`)
