import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'invite',
    description: 'Get the bot invite link',
    usage: '$invite',
    category: 'utility',
    async execute(message, args) {
        const client = message.client;
        const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`;
        
        const embed = new EmbedBuilder()
            .setTitle('🔗 Invite Plagg Bot')
            .setDescription('Add Plagg Bot to your server and start your Isekai adventure!')
            .addFields(
                { name: '🎮 Features', value: '• 50+ Interactive Commands\n• Turn-based Combat System\n• Character Progression\n• Dungeon Exploration\n• Player Marketplace\n• AI Chat Integration', inline: false },
                { name: '🔧 Permissions', value: 'The bot requires Administrator permissions for full functionality.', inline: false },
                { name: '💡 Getting Started', value: 'After inviting, use `$startrpg` to begin your adventure!', inline: false }
            )
            .setColor(0x8b4513)
            .setThumbnail(client.user?.displayAvatarURL())
            .setFooter({ text: 'Thank you for choosing Plagg Bot!' });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🔗 Invite Bot')
                    .setStyle(ButtonStyle.Link)
                    .setURL(inviteLink),
                new ButtonBuilder()
                    .setLabel('📚 Documentation')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://github.com/plagg-bot/docs'),
                new ButtonBuilder()
                    .setLabel('💬 Support Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/plagg-bot')
            );

        await message.reply({ embeds: [embed], components: [row] });
    }
};

export default command;
