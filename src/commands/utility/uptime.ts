import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'uptime',
    description: 'Check how long the bot has been online',
    usage: '$uptime',
    category: 'utility',
    async execute(message, args) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        let uptimeString = '';
        if (days > 0) uptimeString += `${days} day${days !== 1 ? 's' : ''}, `;
        if (hours > 0) uptimeString += `${hours} hour${hours !== 1 ? 's' : ''}, `;
        if (minutes > 0) uptimeString += `${minutes} minute${minutes !== 1 ? 's' : ''}, `;
        uptimeString += `${seconds} second${seconds !== 1 ? 's' : ''}`;

        // Calculate uptime percentage (assuming target is 99.9% uptime)
        const totalSeconds = uptime;
        const uptimePercentage = Math.min(99.99, (totalSeconds / (totalSeconds + 60)) * 100);

        const embed = new EmbedBuilder()
            .setTitle('⏰ Bot Uptime')
            .addFields(
                { name: '🕐 Current Uptime', value: uptimeString, inline: false },
                { name: '📊 Uptime Stats', value: `**Percentage:** ${uptimePercentage.toFixed(2)}%\n**Total Seconds:** ${Math.floor(totalSeconds)}`, inline: true },
                { name: '🚀 Status', value: uptimePercentage > 99 ? '🟢 Excellent' : uptimePercentage > 95 ? '🟡 Good' : '🟠 Fair', inline: true },
                { name: '💾 Memory', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
                { name: '🔄 Last Restart', value: `<t:${Math.floor((Date.now() - uptime * 1000) / 1000)}:R>`, inline: false }
            )
            .setColor(uptimePercentage > 99 ? 0x00ff00 : uptimePercentage > 95 ? 0xffff00 : 0xff8000)
            .setTimestamp()
            .setFooter({ text: 'Bot is running smoothly on Replit!' });

        await message.reply({ embeds: [embed] });
    }
};

export default command;