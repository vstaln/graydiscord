import { Client, Events, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder } from 'discord.js';
import { config } from './config.js';
import { addMessageXp, addVoiceXp, getUser, leaderboard } from './leveling.js';
import { initStarboard } from './starboard.js';
import { moderationCommands, handleModeration } from './moderation.js';
import { initStreams } from './streams.js';
import { startGithubWebhook } from './github.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

client.on(Events.MessageCreate, async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  const r = addMessageXp(msg.guild.id, msg.author.id, msg.content, config.xpCooldownSec * 1000);
  if (r.granted && r.leveledUp) {
    await msg.channel.send(`🎉 <@${msg.author.id}> ranked up to **${r.level}** (${r.xp} XP)`).catch(() => null);
  }
});

// voice leveling: every 5 min, +xp per member in voice (unmuted, non-bot, 2+ humans)
setInterval(async () => {
  try {
    for (const [, guild] of client.guilds.cache) {
      for (const [, ch] of guild.channels.cache) {
        if (!ch.isVoiceBased() || ch.members.size < 2) continue;
        for (const [, m] of ch.members) {
          if (m.user.bot || m.voice.mute || m.voice.deaf || m.voice.selfMute) continue;
          const r = addVoiceXp(guild.id, m.id, 5);
          if (r.leveledUp) await m.send(`🔊 You ranked up to **${r.level}** (${r.xp} XP, voice)`).catch(() => null);
        }
      }
    }
  } catch (e) { console.error('[voice]', e); }
}, 5 * 60_000);

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand() || !i.guild) return;
  if (await handleModeration(i)) return;
  if (i.commandName === 'ping') { await i.reply(`🏓 ${client.ws.ping}ms`); return; }
  if (i.commandName === 'level') {
    const u = i.options.getUser('user') ?? i.user;
    const s = getUser(i.guild.id, u.id);
    await i.reply({ embeds: [new EmbedBuilder().setTitle(`${u.tag} — rank ${s.level || 'unranked'}`).setDescription(`${s.xp} XP`)] });
    return;
  }
  if (i.commandName === 'leaderboard') {
    const top = leaderboard(i.guild.id, 10);
    const lines = top.map((e, idx) => `${idx + 1}. <@${e.userId}> — rank ${e.level}, ${e.xp} XP`);
    await i.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(lines.join('\n') || 'No XP yet')] });
    return;
  }
});

async function main() {
  initStarboard(client);
  client.once(Events.ClientReady, async (c) => {
    console.log(`[bot] logged in as ${c.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(config.token);
    try {
      if (config.guildId) {
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: moderationCommands });
        console.log('[bot] guild commands registered');
      }
    } catch (e) { console.error('[bot] command register failed', e); }
    initStreams(client);
    startGithubWebhook(client);
  });
  if (!config.token) { console.error('Set DISCORD_TOKEN in .env'); process.exit(1); }
  await client.login(config.token);
}

main().catch(e => { console.error(e); process.exit(1); });
