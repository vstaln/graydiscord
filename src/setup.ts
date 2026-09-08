import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import { config } from './config.js';
import { moderationCommands } from './moderation.js';
import { REST, Routes } from 'discord.js';

// One-command server setup. Run locally: cp .env.example .env, fill secrets, npm run setup.
// Creates channels + rank roles, registers slash commands, prints IDs to paste back into .env.
const CHANNELS = ['starboard', 'level-ups', 'streams', 'github-feed'] as const;
const ROLES: { name: string; color: [number, number, number] }[] = [
  { name: 'Rank 5', color: [88, 101, 242] },
  { name: 'Rank 4', color: [87, 242, 135] },
  { name: 'Rank 3', color: [254, 231, 92] },
  { name: 'Rank 2', color: [235, 69, 158] },
  { name: 'Rank 1', color: [237, 66, 69] },
];

async function main() {
  if (!config.token || !config.guildId) {
    console.error('Set DISCORD_TOKEN and GUILD_ID in .env first (cp .env.example .env)');
    process.exit(1);
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  console.log(`[setup] guild: ${guild.name}`);

  const ids: Record<string, string> = {};
  for (const name of CHANNELS) {
    const existing = guild.channels.cache.find(c => c.name === name && c.type === ChannelType.GuildText);
    const ch = existing ?? await guild.channels.create({ name, type: ChannelType.GuildText });
    ids[name] = ch.id;
    console.log(`[setup] #${name}: ${ch.id}`);
  }
  for (const r of ROLES) {
    const existing = guild.roles.cache.find(x => x.name === r.name);
    const role = existing ?? await guild.roles.create({ name: r.name, color: r.color, reason: 'graydiscord ranks' });
    console.log(`[setup] @${role.name}: ${role.id}`);
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: moderationCommands });
  console.log('[setup] slash commands registered');

  console.log('\nPaste into .env:');
  console.log(`STARBOARD_CHANNEL_ID=${ids['starboard']}`);
  console.log(`LEVEL_UP_CHANNEL_ID=${ids['level-ups']}`);
  console.log(`STREAM_ALERT_CHANNEL_ID=${ids['streams']}`);
  console.log(`GITHUB_ALERT_CHANNEL_ID=${ids['github-feed']}`);
  console.log(`\nInvite: https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=8&integration_type=0&scope=bot+applications.commands`);
  await client.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
