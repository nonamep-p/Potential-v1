import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command, InventoryItem } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { getItemById, getRarityEmoji, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'enhance',
    description: 'Enhance your equipment to increase its power',
    usage: '$enhance [item_name]',
    category: 'items',
    cooldown: 120, // 2 minutes
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 15) {
            return message.reply('❌ You need to be level 15 or higher to enhance equipment!');
        }

        const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
        const enhanceableItems = inventory.filter(invItem => {
            const item = getItemById(invItem.itemId);
            return item && (item.type === 'weapon' || item.type === 'armor');
        });

        if (enhanceableItems.length === 0) {
            return message.reply('❌ You have no weapons or armor to enhance!');
        }

        if (args.length === 0) {
            await showEnhanceMenu(message, player, enhanceableItems);
        } else {
            const itemName = args.join(' ').toLowerCase();
            await attemptEnhance(message, player, itemName);
        }
    }
};

async function showEnhanceMenu(message: any, player: any, enhanceableItems: InventoryItem[]) {
    let currentPage = 0;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(enhanceableItems.length / itemsPerPage);

    const generateEmbed = (page: number) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = enhanceableItems.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle('⚡ Enhancement Workshop')
            .setDescription('Choose an item to enhance its power!')
            .setColor(0x4169e1)
            .setFooter({ text: `Page ${page + 1}/${totalPages} | Enhancement costs gold and materials` });

        for (const invItem of pageItems) {
            const item = getItemById(invItem.itemId);
            if (!item) continue;

            const enhanceLevel = getItemEnhanceLevel(invItem.itemId, player);
            const cost = calculateEnhanceCost(enhanceLevel);
            const canAfford = player.gold >= cost;

            embed.addFields({
                name: `${getRarityEmoji(item.rarity)} ${item.name} +${enhanceLevel} ${canAfford ? '✅' : '❌'}`,
                value: `**Type:** ${item.type}\n**Enhancement Cost:** ${formatNumber(cost)} gold\n**Success Rate:** ${calculateSuccessRate(enhanceLevel)}%`,
                inline: false
            });
        }

        return embed;
    };

    const generateButtons = (page: number) => {
        const buttons = [
            new ButtonBuilder()
                .setCustomId('enhance_prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('enhance_next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        ];

        // Add enhance buttons for current page items
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = enhanceableItems.slice(start, end);

        for (let i = 0; i < Math.min(2, pageItems.length); i++) {
            const item = getItemById(pageItems[i].itemId);
            if (item) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`enhance_item_${start + i}`)
                        .setLabel(`⚡ ${item.name}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }
        }

        return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    };

    const response = await message.reply({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)]
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 120000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        if (interaction.customId === 'enhance_prev' && currentPage > 0) {
            currentPage--;
        } else if (interaction.customId === 'enhance_next' && currentPage < totalPages - 1) {
            currentPage++;
        } else if (interaction.customId.startsWith('enhance_item_')) {
            const itemIndex = parseInt(interaction.customId.split('_')[2]);
            const item = enhanceableItems[itemIndex];
            if (item) {
                const itemData = getItemById(item.itemId);
                if (itemData) {
                    await attemptEnhanceItem(response, player, itemData.name);
                    return;
                }
            }
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

async function attemptEnhance(message: any, player: any, itemName: string) {
    const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
    const inventoryItem = inventory.find(invItem => {
        const item = getItemById(invItem.itemId);
        return item && item.name.toLowerCase().includes(itemName);
    });

    if (!inventoryItem) {
        return message.reply('❌ Item not found in your inventory!');
    }

    const item = getItemById(inventoryItem.itemId);
    if (!item) {
        return message.reply('❌ Invalid item!');
    }

    await attemptEnhanceItem(message, player, item.name);
}

async function attemptEnhanceItem(message: any, player: any, itemName: string) {
    const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
    const inventoryItem = inventory.find(invItem => {
        const item = getItemById(invItem.itemId);
        return item && item.name === itemName;
    });

    if (!inventoryItem) {
        return message.reply('❌ Item not found!');
    }

    const item = getItemById(inventoryItem.itemId);
    if (!item) {
        return message.reply('❌ Invalid item!');
    }

    const currentEnhance = getItemEnhanceLevel(item.id, player);
    const cost = calculateEnhanceCost(currentEnhance);
    const successRate = calculateSuccessRate(currentEnhance);

    if (currentEnhance >= 15) {
        return message.reply('❌ This item is already at maximum enhancement level (+15)!');
    }

    if (player.gold < cost) {
        return message.reply(`❌ You need ${formatNumber(cost)} gold to enhance this item!`);
    }

    // Show confirmation
    const confirmEmbed = new EmbedBuilder()
        .setTitle('⚡ Enhancement Confirmation')
        .setDescription(`Enhance **${item.name} +${currentEnhance}**?`)
        .addFields(
            { name: '💰 Cost', value: formatNumber(cost), inline: true },
            { name: '🎯 Success Rate', value: `${successRate}%`, inline: true },
            { name: '⚠️ Warning', value: 'Failed enhancement may destroy the item!', inline: false },
            { name: '📈 Enhancement Bonus', value: `+${calculateStatBonus(currentEnhance + 1)}% to all stats`, inline: false }
        )
        .setColor(successRate >= 70 ? 0x00ff00 : successRate >= 40 ? 0xffff00 : 0xff4500);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('enhance_confirm')
                .setLabel('⚡ Enhance Item')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('enhance_cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    const response = await message.edit({ embeds: [confirmEmbed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 30000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        if (interaction.customId === 'enhance_confirm') {
            await executeEnhancement(response, player, item, currentEnhance, cost, successRate);
        } else {
            const cancelEmbed = new EmbedBuilder()
                .setTitle('❌ Enhancement Cancelled')
                .setDescription('You decided not to enhance the item.')
                .setColor(0xff0000);

            await response.edit({ embeds: [cancelEmbed], components: [] });
        }
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            response.edit({ components: [] });
        }
    });
}

async function executeEnhancement(message: any, player: any, item: any, currentEnhance: number, cost: number, successRate: number) {
    const enhanceRoll = Math.random() * 100;
    const isSuccess = enhanceRoll <= successRate;
    const isCriticalFailure = enhanceRoll >= 95 && currentEnhance >= 10;

    // Always deduct gold
    const newGold = player.gold - cost;

    if (isSuccess) {
        // Success - increase enhancement level
        const newEnhanceLevel = currentEnhance + 1;
        await updateItemEnhanceLevel(player.discordId, item.id, newEnhanceLevel);

        await updatePlayer(player.discordId, {
            gold: newGold,
            xp: player.xp + (currentEnhance + 1) * 25
        });

        const successEmbed = new EmbedBuilder()
            .setTitle('✨ Enhancement Successful!')
            .setDescription(`**${item.name}** is now **+${newEnhanceLevel}**!`)
            .addFields(
                { name: '📈 New Enhancement Level', value: `+${newEnhanceLevel}`, inline: true },
                { name: '💪 Stat Bonus', value: `+${calculateStatBonus(newEnhanceLevel)}%`, inline: true },
                { name: '⭐ XP Gained', value: `${(currentEnhance + 1) * 25}`, inline: true },
                { name: '💵 Gold Remaining', value: formatNumber(newGold), inline: true }
            )
            .setColor(0x00ff00)
            .setFooter({ text: item.plaggComment || 'The power flows through the item!' });

        await message.edit({ embeds: [successEmbed], components: [] });

    } else if (isCriticalFailure) {
        // Critical failure - destroy item
        const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
        const updatedInventory = inventory.filter(invItem => invItem.itemId !== item.id);

        await updatePlayer(player.discordId, {
            gold: newGold,
            inventoryJson: JSON.stringify(updatedInventory)
        });

        const destroyEmbed = new EmbedBuilder()
            .setTitle('💥 Critical Failure!')
            .setDescription(`**${item.name}** was destroyed in the enhancement process!`)
            .addFields(
                { name: '💀 Item Destroyed', value: item.name, inline: true },
                { name: '💸 Gold Lost', value: formatNumber(cost), inline: true },
                { name: '💵 Gold Remaining', value: formatNumber(newGold), inline: true }
            )
            .setColor(0x8b0000)
            .setFooter({ text: 'High-level enhancements carry great risk!' });

        await message.edit({ embeds: [destroyEmbed], components: [] });

    } else {
        // Normal failure - just lose gold and possibly reduce enhancement
        let newEnhanceLevel = currentEnhance;
        if (currentEnhance > 10 && Math.random() < 0.3) {
            newEnhanceLevel = Math.max(0, currentEnhance - 1);
            await updateItemEnhanceLevel(player.discordId, item.id, newEnhanceLevel);
        }

        await updatePlayer(player.discordId, {
            gold: newGold
        });

        const failureEmbed = new EmbedBuilder()
            .setTitle('💫 Enhancement Failed')
            .setDescription(`The enhancement failed, but **${item.name}** survived.`)
            .addFields(
                { name: '💸 Gold Lost', value: formatNumber(cost), inline: true },
                { name: '💵 Gold Remaining', value: formatNumber(newGold), inline: true }
            )
            .setColor(0xff8000);

        if (newEnhanceLevel < currentEnhance) {
            failureEmbed.addFields({
                name: '📉 Enhancement Reduced',
                value: `+${currentEnhance} → +${newEnhanceLevel}`,
                inline: true
            });
        }

        failureEmbed.setFooter({ text: 'Try again when you have more gold!' });

        await message.edit({ embeds: [failureEmbed], components: [] });
    }
}

function getItemEnhanceLevel(itemId: string, player: any): number {
    // In a real implementation, this would be stored in the database
    // For now, we'll use a simple hash based on player ID and item ID
    const hash = (player.discordId + itemId).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    return Math.abs(hash) % 5; // Random enhancement level 0-4 for demo
}

async function updateItemEnhanceLevel(playerId: string, itemId: string, level: number) {
    // In a real implementation, this would update the database
    // For now, this is a placeholder
    console.log(`Updated ${itemId} enhancement to +${level} for player ${playerId}`);
}

function calculateEnhanceCost(enhanceLevel: number): number {
    return Math.floor(1000 * Math.pow(1.5, enhanceLevel));
}

function calculateSuccessRate(enhanceLevel: number): number {
    if (enhanceLevel < 3) return 95;
    if (enhanceLevel < 6) return 85;
    if (enhanceLevel < 9) return 70;
    if (enhanceLevel < 12) return 50;
    return 30;
}

function calculateStatBonus(enhanceLevel: number): number {
    return enhanceLevel * 5; // 5% per enhancement level
}

export default command;
