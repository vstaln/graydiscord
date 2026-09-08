import { Client, GatewayIntentBits, ChannelType, EmbedBuilder, type CategoryChannel, type TextChannel } from 'discord.js';
import { config } from './config.js';
import { moderationCommands } from './moderation.js';
import { REST, Routes } from 'discord.js';

// One-command server setup: npm run setup (needs DISCORD_TOKEN + GUILD_ID in .env).
// Manages ONLY bot channels/roles by exact name; everything else in your server is left alone.
// Layout: INFO (rules, announcements) / COMMUNITY (starboard) / LIVE (streams, github-feed).
const LAYOUT: Record<string, string[]> = {
  'INFO': ['rules', 'announcements'],
  'COMMUNITY': ['starboard'],
  'LIVE': ['streams', 'github-feed'],
};
// Channels this script owns. 'level-ups' is legacy (rank-ups now post where you chat) — deleted.
const DEAD = ['level-ups'];

const RANK_ROLES: { name: string; color: number }[] = [
  { name: 'Rank 5', color: 0x5865f2 },
  { name: 'Rank 4', color: 0x57f287 },
  { name: 'Rank 3', color: 0xfee75c },
  { name: 'Rank 2', color: 0xeb459e },
  { name: 'Rank 1', color: 0xed4245 },
];
const COLOR_ROLES: { name: string; color: number }[] = [
  { name: 'Red', color: 0xed4245 },
  { name: 'Orange', color: 0xe67e22 },
  { name: 'Yellow', color: 0xfee75c },
  { name: 'Green', color: 0x57f287 },
  { name: 'Cyan', color: 0x00c0f4 },
  { name: 'Blue', color: 0x5865f2 },
  { name: 'Purple', color: 0x9b59b6 },
  { name: 'Pink', color: 0xeb459e },
];

const RULES = new EmbedBuilder()
  .setTitle('Server rules')
  .setColor(0x5865f2)
  .setDescription([
    '1. Be kind — no harassment, hate, or spam.',
    '2. Keep it on-topic — dev talk, streams, and progress.',
    '3. No NSFW or pirated content.',
    '4. Rank up by chatting (5→1) — quality > quantity, spam earns nothing.',
    '5. Mods have final say. Questions? Open a ticket by pinging a mod.',
  ].join('\n'));

async function main() {
  if (!config.token || !config.guildId) {
    console.error('Set DISCORD_TOKEN and GUILD_ID in .env first (cp .env.example .env)');
    process.exit(1);
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  await guild.channels.fetch();
  await guild.roles.fetch();
  console.log(`[setup] guild: ${guild.name}`);

  // categories
  const cats: Record<string, CategoryChannel> = {};
  for (const name of Object.keys(LAYOUT)) {
    const existing = guild.channels.cache.find(c => c.name === name && c.type === ChannelType.GuildCategory);
    cats[name] = (existing ?? await guild.channels.create({ name, type: ChannelType.GuildCategory })) as CategoryChannel;
  }

  // dead channels (legacy)
  for (const name of DEAD) {
    for (const ch of guild.channels.cache.filter(c => c.name === name && c.type === ChannelType.GuildText).values()) {
      await (ch as TextChannel).delete('graydiscord: legacy channel').catch(() => null);
      console.log(`[setup] deleted #${name} (${ch.id})`);
    }
  }

  // owned channels: dedupe by name (keep .env pin or first), create, move to category
  const ids: Record<string, string> = {};
  for (const [cat, names] of Object.entries(LAYOUT)) {
    for (const name of names) {
      const dupes = [...guild.channels.cache.filter(c => c.name === name && c.type === ChannelType.GuildText).values()] as TextChannel[];
      let keep = dupes.find(c => c.id === config.starboardChannelId && name === 'starboard') ?? dupes[0]
        ?? await guild.channels.create({ name, type: ChannelType.GuildText, parent: cats[cat].id }) as TextChannel;
      for (const d of dupes) {
        if (d.id !== keep.id) { await d.delete('graydiscord: duplicate channel').catch(() => null); console.log(`[setup] deleted duplicate #${name} (${d.id})`); }
      }
      if (keep.parentId !== cats[cat].id) await keep.setParent(cats[cat].id).catch(() => null);
      ids[name] = keep.id;
      console.log(`[setup] #${name}: ${keep.id}`);
    }
  }

  // rules embed (once)
  const rules = guild.channels.cache.find(c => c.id === ids['rules']) as TextChannel;
  const recent = await rules.messages.fetch({ limit: 10 }).catch(() => null);
  const hasRules = recent?.some(m => m.author.id === client.user?.id && m.embeds.some(e => e.title === 'Server rules'));
  if (!hasRules) { await rules.send({ embeds: [RULES] }); console.log('[setup] posted rules embed'); }

  // roles (idempotent)
  for (const r of [...RANK_ROLES, ...COLOR_ROLES]) {
    const existing = guild.roles.cache.find(x => x.name === r.name);
    const role = existing ?? await guild.roles.create({ name: r.name, colors: { primaryColor: r.color }, reason: 'graydiscord setup' });
    console.log(`[setup] @${role.name}: ${role.id}`);
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: moderationCommands });
  console.log('[setup] slash commands registered');

  console.log('\nPaste into .env:');
  console.log(`STARBOARD_CHANNEL_ID=${ids['starboard']}`);
  console.log(`STREAM_ALERT_CHANNEL_ID=${ids['streams']}`);
  console.log(`GITHUB_ALERT_CHANNEL_ID=${ids['github-feed']}`);
  await client.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
