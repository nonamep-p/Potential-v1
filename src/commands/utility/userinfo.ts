import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer } from '../../utils/database.js';

const command: Command = {
    name: 'userinfo',
    description: 'Display information about a user',
    usage: '$userinfo [@user]',
    category: 'utility',
    async execute(message, args) {
        const targetUser = message.mentions.users.first() || message.author;
        const member = message.guild?.members.cache.get(targetUser.id);
        
        const embed = new EmbedBuilder()
            .setTitle(`👤 ${targetUser.username}'s Information`)
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '🏷️ Username', value: targetUser.username, inline: true },
                { name: '🆔 User ID', value: targetUser.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true }
            )
            .setColor(0x8b4513)
            .setTimestamp();

        if (member) {
            embed.addFields(
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>`, inline: true },
                { name: '🎭 Nickname', value: member.nickname || 'None', inline: true }
            );

            const roles = member.roles.cache
                .filter(role => role.id !== message.guild!.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString());

            if (roles.length > 0) {
                embed.addFields({
                    name: `🎭 Roles [${roles.length}]`,
                    value: roles.length > 10 ? roles.slice(0, 10).join(', ') + '...' : roles.join(', '),
                    inline: false
                });
            }
        }

        // Add RPG information if player exists
        try {
            const player = await getPlayer(targetUser.id);
            if (player) {
                embed.addFields({
                    name: '🎮 RPG Stats',
                    value: `**Level:** ${player.level}\n**Class:** ${player.className}\n**Gold:** ${player.gold.toLocaleString()}`,
                    inline: false
                });
            }
        } catch (error) {
            // Player doesn't exist in RPG system
        }

        embed.setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

        await message.reply({ embeds: [embed] });
    }
};

export default command;
