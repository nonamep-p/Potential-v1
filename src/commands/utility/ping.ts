import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'ping',
    description: 'Check bot latency and response time',
    usage: '$ping',
    category: 'utility',
    async execute(message, args) {
        const sent = await message.reply('🏓 Pinging...');
        const timeDiff = sent.createdTimestamp - message.createdTimestamp;
        const wsLatency = message.client.ws.ping;

        // Determine latency quality
        let latencyEmoji = '🟢';
        let latencyQuality = 'Excellent';
        
        if (timeDiff > 200) {
            latencyEmoji = '🟡';
            latencyQuality = 'Good';
        }
        if (timeDiff > 500) {
            latencyEmoji = '🟠';
            latencyQuality = 'Poor';
        }
        if (timeDiff > 1000) {
            latencyEmoji = '🔴';
            latencyQuality = 'Very Poor';
        }

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📡 Bot Latency', value: `${timeDiff}ms`, inline: true },
                { name: '💓 API Latency', value: `${wsLatency}ms`, inline: true },
                { name: '📊 Quality', value: `${latencyEmoji} ${latencyQuality}`, inline: true },
                { name: '⏱️ Response Time', value: `${Date.now() - message.createdTimestamp}ms`, inline: false }
            )
            .setColor(timeDiff < 200 ? 0x00ff00 : timeDiff < 500 ? 0xffff00 : 0xff0000)
            .setTimestamp();

        await sent.edit({ content: '', embeds: [embed] });
    }
};

export default command;
