import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command, InventoryItem } from '../../types.js';
import { getPlayer } from '../../utils/database.js';
import { getItemById, getRarityEmoji } from '../../utils/helpers.js';

const command: Command = {
    name: 'inventory',
    description: 'View your inventory',
    usage: '$inventory',
    category: 'character',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
        
        if (inventory.length === 0) {
            return message.reply('📦 Your inventory is empty!');
        }

        let currentPage = 0;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(inventory.length / itemsPerPage);

        const generateEmbed = (page: number) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = inventory.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle('📦 Your Inventory')
                .setColor(0x8b4513)
                .setFooter({ text: `Page ${page + 1}/${totalPages}` });

            let description = '';
            for (const invItem of pageItems) {
                const item = getItemById(invItem.itemId);
                if (item) {
                    const emoji = getRarityEmoji(item.rarity);
                    description += `${emoji} **${item.name}** x${invItem.quantity}\n`;
                }
            }

            embed.setDescription(description || 'No items to display.');
            return embed;
        };

        const generateButtons = (page: number) => {
            return new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('inventory_prev')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('inventory_next')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('inventory_use')
                        .setLabel('🔧 Use Item')
                        .setStyle(ButtonStyle.Primary)
                );
        };

        const response = await message.reply({
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)]
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === message.author.id,
            time: 60000
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();

            if (interaction.customId === 'inventory_prev' && currentPage > 0) {
                currentPage--;
            } else if (interaction.customId === 'inventory_next' && currentPage < totalPages - 1) {
                currentPage++;
            } else if (interaction.customId === 'inventory_use') {
                // Handle item usage
                await interaction.followUp({
                    content: '🔧 Item usage feature coming soon!',
                    ephemeral: true
                });
                return;
            }

            await response.edit({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            response.edit({ components: [] });
        });
    }
};

export default command;
