
import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'info',
    description: 'Display bot information and statistics',
    usage: '$info',
    category: 'utility',
    async execute(message, args) {
        const client = message.client;
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const memoryUsage = process.memoryUsage();
        const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

        const embed = new EmbedBuilder()
            .setTitle('🤖 Plagg Bot Information')
            .setDescription('A chaotic, cheese-fueled Isekai RPG for Discord!')
            .setThumbnail(client.user?.displayAvatarURL() || null)
            .addFields(
                { name: '📊 Bot Statistics', value: `**Servers:** ${client.guilds.cache.size}\n**Users:** ${client.users.cache.size}\n**Commands:** 50+`, inline: true },
                { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
                { name: '💾 Memory Usage', value: `${memoryUsedMB}MB / ${memoryTotalMB}MB`, inline: true },
                { name: '🎮 Features', value: '• Turn-based Combat System\n• Character Progression\n• Dungeon Exploration\n• Player Marketplace\n• AI Chat Integration\n• Isekai Scenarios', inline: false },
                { name: '🔧 Technology', value: '• Discord.js v14\n• TypeScript\n• Prisma ORM\n• SQLite Database\n• Google Gemini AI\n• Express Server', inline: false },
                { name: '🌟 Version', value: '1.0.0', inline: true },
                { name: '📝 Language', value: 'TypeScript', inline: true },
                { name: '🏠 Hosting', value: 'Replit', inline: true }
            )
            .setColor(0x8b4513)
            .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

        await message.reply({ embeds: [embed] });
    }
};

export default command;
