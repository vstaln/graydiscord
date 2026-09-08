import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const file = join(dir, 'levels.json');

// ponytail: JSON file store, migrate to Postgres/Prisma if server grows past single-host
type Entry = { xp: number; lastXp: number; lastHash: string; lastHashAt: number };
type Store = Record<string, Record<string, Entry>>;
const blank = (): Entry => ({ xp: 0, lastXp: 0, lastHash: '', lastHashAt: 0 });
let cache: Store = {};
try {
  mkdirSync(dir, { recursive: true });
  if (existsSync(file)) cache = sanitizeLoaded(JSON.parse(readFileSync(file, 'utf8')));
} catch { cache = {}; }

function save() {
  try { writeFileSync(file, JSON.stringify(cache)); } catch {}
}

// Prestige ladder: 0 (newcomer) -> 5 -> 4 -> 3 -> 2 -> 1 (top).
// Thresholds: 5=500, 4=4000, 3=30000, 2=200000, 1=1000000.
// Lifetime-achievable: ~20 XP/msg + voice trickle; 1M ≈ 40k msgs + voice.
export const THRESHOLDS = [
  { rank: 1, xp: 1_000_000 },
  { rank: 2, xp: 200_000 },
  { rank: 3, xp: 30_000 },
  { rank: 4, xp: 4_000 },
  { rank: 5, xp: 500 },
] as const;

// ponytail: hard cap stops int/JSON corruption from wrapping XP back to 0 and wiping rank
export const MAX_XP = 2_000_000;

function clampXp(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(MAX_XP, Math.max(0, Math.floor(n)));
}

function sanitizeLoaded(raw: unknown): Store {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Store = {};
  for (const [g, users] of Object.entries(raw as Store)) {
    if (typeof users !== 'object' || users === null) continue;
    out[g] = {};
    for (const [u, v] of Object.entries(users)) {
      out[g][u] = {
        xp: clampXp(v?.xp),
        lastXp: typeof v?.lastXp === 'number' && Number.isFinite(v.lastXp) ? v.lastXp : 0,
        lastHash: typeof (v as any)?.lastHash === 'string' ? (v as any).lastHash : '',
        lastHashAt: typeof (v as any)?.lastHashAt === 'number' ? (v as any).lastHashAt : 0,
      };
    }
  }
  return out;
}

export function levelOf(xp: unknown): number {
  const v = clampXp(xp);
  for (const t of THRESHOLDS) if (v >= t.xp) return t.rank;
  return 0;
}

const order = (rank: number) => (rank === 0 ? 0 : 6 - rank); // 0<5<4<3<2<1

function grant(guildId: string, userId: string, amount: number) {
  cache[guildId] ??= {};
  const cur = cache[guildId][userId] ?? blank();
  const before = levelOf(cur.xp);
  cur.xp = clampXp(cur.xp + clampXp(amount));
  cache[guildId][userId] = cur;
  save();
  const after = levelOf(cur.xp);
  return { leveledUp: order(after) > order(before), xp: cur.xp, level: after };
}

// likeness hash for anti-spam: normalized, truncated
function hashContent(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 128);
}

export function addMessageXp(guildId: string, userId: string, content: string, cooldownMs: number) {
  const now = Date.now();
  cache[guildId] ??= {};
  const cur = cache[guildId][userId] ?? blank();
  const lvl = levelOf(cur.xp);
  if (now - cur.lastXp < cooldownMs) return { granted: false, leveledUp: false, xp: cur.xp, level: lvl };
  const text = (content || '').trim();
  if (text.length < 4) return { granted: false, leveledUp: false, xp: cur.xp, level: lvl }; // no "a" farming
  const h = hashContent(text);
  if (h && h === cur.lastHash && now - cur.lastHashAt < 5 * 60_000) {
    return { granted: false, leveledUp: false, xp: cur.xp, level: lvl }; // same msg spam
  }
  // length-scaled, capped: 5 base + 1 per 20 chars, max 25
  const amount = Math.min(25, 5 + Math.floor(text.length / 20));
  cur.lastXp = now;
  cur.lastHash = h;
  cur.lastHashAt = now;
  cache[guildId][userId] = cur;
  const r = grant(guildId, userId, amount);
  const e = cache[guildId][userId];
  e.lastXp = now; e.lastHash = h; e.lastHashAt = now;
  save();
  return { granted: true, ...r };
}

export function addVoiceXp(guildId: string, userId: string, minutes: number, xpPerMin = 10) {
  if (!(minutes > 0)) return { leveledUp: false, xp: getUser(guildId, userId).xp, level: levelOf(getUser(guildId, userId).xp) };
  return grant(guildId, userId, Math.min(600, Math.floor(minutes * xpPerMin))); // cap 600/tick
}

// backwards-compat for callers using generic addXp
export function addXp(guildId: string, userId: string, amount: number, cooldownMs: number) {
  const now = Date.now();
  cache[guildId] ??= {};
  const cur = cache[guildId][userId] ?? blank();
  if (now - cur.lastXp < cooldownMs) return { leveledUp: false, xp: clampXp(cur.xp), level: levelOf(cur.xp) };
  cur.lastXp = now;
  cache[guildId][userId] = cur;
  return grant(guildId, userId, amount);
}

export function getUser(guildId: string, userId: string) {
  const cur = cache[guildId]?.[userId] ?? blank();
  return { xp: clampXp(cur.xp), level: levelOf(cur.xp) };
}

export function leaderboard(guildId: string, n = 10) {
  return Object.entries(cache[guildId] ?? {})
    .map(([userId, v]) => ({ userId, xp: v.xp, level: levelOf(v.xp) }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, n);
}
