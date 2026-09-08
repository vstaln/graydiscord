import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';

export const moderationCommands = [
  new SlashCommandBuilder().setName('ping').setDescription('Latency check'),
  new SlashCommandBuilder().setName('level').setDescription('Show your rank')
    .addUserOption(o => o.setName('user').setDescription('User to check')),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 by XP'),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member (min)')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Minutes 1-40320').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('purge').setDescription('Bulk delete (max 100)')
    .addIntegerOption(o => o.setName('count').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map(c => c.toJSON());

export async function handleModeration(i: ChatInputCommandInteraction) {
  const { commandName } = i;
  if (commandName === 'warn') {
    const u = i.options.getUser('user', true);
    const reason = i.options.getString('reason') ?? 'No reason';
    await i.reply({ content: `⚠️ Warned ${u.tag}: ${reason}`, ephemeral: true });
    try { await u.send(`You were warned in ${i.guild?.name}: ${reason}`); } catch {}
    return true;
  }
  if (commandName === 'timeout') {
    const u = i.options.getUser('user', true);
    const mins = i.options.getInteger('minutes', true);
    const reason = i.options.getString('reason') ?? 'No reason';
    const m = await i.guild?.members.fetch(u.id).catch(() => null);
    if (!m) { await i.reply({ content: 'Member not found', ephemeral: true }); return true; }
    await m.timeout(mins * 60_000, reason).catch(() => null);
    await i.reply(`⏱️ Timed out ${u.tag} for ${mins}m: ${reason}`);
    return true;
  }
  if (commandName === 'kick') {
    const u = i.options.getUser('user', true);
    const reason = i.options.getString('reason') ?? 'No reason';
    await i.guild?.members.kick(u.id, reason).catch(() => null);
    await i.reply(`👢 Kicked ${u.tag}: ${reason}`);
    return true;
  }
  if (commandName === 'ban') {
    const u = i.options.getUser('user', true);
    const reason = i.options.getString('reason') ?? 'No reason';
    await i.guild?.members.ban(u.id, { reason }).catch(() => null);
    await i.reply(`🔨 Banned ${u.tag}: ${reason}`);
    return true;
  }
  if (commandName === 'purge') {
    const n = i.options.getInteger('count', true);
    if (!i.channel?.isTextBased() || !('bulkDelete' in i.channel)) { await i.reply({ content: 'Not bulk-deletable here', ephemeral: true }); return true; }
    await (i.channel as any).bulkDelete(n, true).catch(() => null);
    await i.reply({ content: `🧹 Deleted ${n}`, ephemeral: true });
    return true;
  }
  return false;
}
