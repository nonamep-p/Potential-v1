import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'serverinfo',
    description: 'Display information about the current server',
    usage: '$serverinfo',
    category: 'utility',
    async execute(message, args) {
        const guild = message.guild;
        if (!guild) {
            return message.reply('❌ This command can only be used in a server!');
        }

        const owner = await guild.fetchOwner();
        const channels = guild.channels.cache;
        const roles = guild.roles.cache;
        
        const textChannels = channels.filter(c => c.type === 0).size;
        const voiceChannels = channels.filter(c => c.type === 2).size;
        const categories = channels.filter(c => c.type === 4).size;

        const verificationLevels = {
            0: 'None',
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Very High'
        };

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${guild.name} Server Information`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: '👑 Owner', value: `${owner.user.username}`, inline: true },
                { name: '🆔 Server ID', value: guild.id, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '🎭 Roles', value: `${roles.size}`, inline: true },
                { name: '💬 Channels', value: `📝 ${textChannels} | 🔊 ${voiceChannels} | 📁 ${categories}`, inline: true },
                { name: '🔒 Verification Level', value: verificationLevels[guild.verificationLevel] || 'Unknown', inline: true },
                { name: '🚀 Boost Level', value: `${guild.premiumTier}`, inline: true },
                { name: '💎 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
            )
            .setColor(0x8b4513)
            .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        if (guild.description) {
            embed.setDescription(guild.description);
        }

        await message.reply({ embeds: [embed] });
    }
};

export default command;
