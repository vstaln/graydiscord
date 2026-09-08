import { Events, EmbedBuilder, type PartialMessageReaction, type PartialUser, type MessageReaction, type User } from 'discord.js';
import type { Client } from 'discord.js';
import { config } from './config.js';

// ponytail: in-memory dupe guard (resets on restart), persist if starboard dupes become an issue
const posted = new Set<string>();

export function initStarboard(client: Client) {
  client.on(Events.MessageReactionAdd, async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    try {
      if (reaction.emoji.name !== '⭐') return;
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch();
      const msg = reaction.message;
      if (msg.partial) await msg.fetch();
      if (!msg.guild || msg.author?.bot || msg.author?.id === user.id) return;
      if (!config.starboardChannelId) return;
      if (posted.has(msg.id)) return;
      const count = reaction.count ?? 1;
      if (count < config.starboardThreshold) return;
      const channel = await msg.guild.channels.fetch(config.starboardChannelId).catch(() => null);
      if (!channel?.isTextBased() || !channel.isSendable()) return;
      posted.add(msg.id);
      const embed = new EmbedBuilder()
        .setAuthor({ name: msg.author?.tag ?? 'unknown', iconURL: msg.author?.displayAvatarURL() })
        .setDescription((msg.content || '').slice(0, 4000) || '(attachment)')
        .setTimestamp(msg.createdAt)
        .addFields({ name: 'Jump', value: `[Go to message](${msg.url})` });
      const img = msg.attachments.find(a => a.contentType?.startsWith('image'));
      if (img) embed.setImage(img.url);
      await channel.send({ content: `⭐ ${count} <#${msg.channelId}>`, embeds: [embed] });
    } catch (e) { console.error('[starboard]', e); }
  });
}
