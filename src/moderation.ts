import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';

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
  new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID')
    .addStringOption(o => o.setName('userid').setDescription('Banned user ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('untimeout').setDescription('Remove timeout from a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode (0=off, max 21600s)')
    .addIntegerOption(o => o.setName('seconds').setDescription('Seconds').setRequired(true).setMinValue(0).setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('lock').setDescription('Lock this channel (@everyone cannot send)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('unlock').setDescription('Unlock this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('userinfo').setDescription('Show info about a user')
    .addUserOption(o => o.setName('user').setDescription('User to check')),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show info about this server'),
  new SlashCommandBuilder().setName('avatar').setDescription("Show a user's avatar")
    .addUserOption(o => o.setName('user').setDescription('User to check')),
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
  if (commandName === 'unban') {
    const id = i.options.getString('userid', true).trim();
    const reason = i.options.getString('reason') ?? 'No reason';
    const ok = await i.guild?.members.unban(id, reason).then(() => true).catch(() => false);
    await i.reply(ok ? `✅ Unbanned <@${id}>: ${reason}` : `❌ Could not unban \`${id}\` (bad ID or not banned)`);
    return true;
  }
  if (commandName === 'untimeout') {
    const u = i.options.getUser('user', true);
    const m = await i.guild?.members.fetch(u.id).catch(() => null);
    if (!m) { await i.reply({ content: 'Member not found', ephemeral: true }); return true; }
    await m.timeout(null).catch(() => null);
    await i.reply(`✅ Removed timeout from ${u.tag}`);
    return true;
  }
  if (commandName === 'slowmode') {
    const secs = i.options.getInteger('seconds', true);
    if (!i.channel?.isTextBased() || !('setRateLimitPerUser' in i.channel)) { await i.reply({ content: 'Slowmode not supported here', ephemeral: true }); return true; }
    await (i.channel as any).setRateLimitPerUser(secs).catch(() => null);
    await i.reply(secs === 0 ? '🐢 Slowmode off' : `🐢 Slowmode set to ${secs}s`);
    return true;
  }
  if (commandName === 'lock' || commandName === 'unlock') {
    if (!i.channel || !('permissionOverwrites' in i.channel) || !i.guild) { await i.reply({ content: 'Not lockable here', ephemeral: true }); return true; }
    const locked = commandName === 'lock';
    await (i.channel as any).permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: !locked }).catch(() => null);
    await i.reply(locked ? '🔒 Channel locked' : '🔓 Channel unlocked');
    return true;
  }
  if (commandName === 'userinfo') {
    const u = i.options.getUser('user') ?? i.user;
    const m = await i.guild?.members.fetch(u.id).catch(() => null);
    const embed = new EmbedBuilder()
      .setTitle(u.tag)
      .setThumbnail(u.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: u.id, inline: true },
        { name: 'Bot', value: u.bot ? 'yes' : 'no', inline: true },
        { name: 'Created', value: `<t:${Math.floor(u.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Joined', value: m?.joinedTimestamp ? `<t:${Math.floor(m.joinedTimestamp / 1000)}:D>` : '—', inline: true },
        { name: 'Roles', value: m ? [...m.roles.cache.values()].filter(r => r.name !== '@everyone').slice(0, 10).map(r => r.name).join(', ') || 'none' : '—' },
      );
    await i.reply({ embeds: [embed] });
    return true;
  }
  if (commandName === 'serverinfo') {
    const g = i.guild;
    const embed = new EmbedBuilder()
      .setTitle(g?.name ?? 'Server')
      .setThumbnail(g?.iconURL() ?? null)
      .addFields(
        { name: 'ID', value: g?.id ?? '—', inline: true },
        { name: 'Owner', value: g ? `<@${g.ownerId}>` : '—', inline: true },
        { name: 'Created', value: g?.createdAt ? `<t:${Math.floor(g.createdAt.getTime() / 1000)}:D>` : '—', inline: true },
        { name: 'Members', value: `${g?.memberCount ?? '?'}`, inline: true },
        { name: 'Channels', value: `${g?.channels.cache.size ?? '?'}`, inline: true },
        { name: 'Roles', value: `${g?.roles.cache.size ?? '?'}`, inline: true },
      );
    await i.reply({ embeds: [embed] });
    return true;
  }
  if (commandName === 'avatar') {
    const u = i.options.getUser('user') ?? i.user;
    await i.reply({ embeds: [new EmbedBuilder().setTitle(u.tag).setImage(u.displayAvatarURL({ size: 1024 }))] });
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
