import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command, InventoryItem } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { getItemById, getRarityEmoji, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'enchant',
    description: 'Add magical enchantments to your equipment',
    usage: '$enchant [item_name]',
    category: 'items',
    cooldown: 300, // 5 minutes
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 20) {
            return message.reply('❌ You need to be level 20 or higher to enchant equipment!');
        }

        const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
        const enchantableItems = inventory.filter(invItem => {
            const item = getItemById(invItem.itemId);
            return item && (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory');
        });

        if (enchantableItems.length === 0) {
            return message.reply('❌ You have no equipment to enchant!');
        }

        if (args.length === 0) {
            await showEnchantMenu(message, player, enchantableItems);
        } else {
            const itemName = args.join(' ').toLowerCase();
            await attemptEnchant(message, player, itemName);
        }
    }
};

async function showEnchantMenu(message: any, player: any, enchantableItems: InventoryItem[]) {
    let currentPage = 0;
    const itemsPerPage = 4;
    const totalPages = Math.ceil(enchantableItems.length / itemsPerPage);

    const generateEmbed = (page: number) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = enchantableItems.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle('✨ Enchantment Chamber')
            .setDescription('Imbue your equipment with magical power!')
            .setColor(0x9400d3)
            .setFooter({ text: `Page ${page + 1}/${totalPages} | Enchanting requires rare materials` });

        for (const invItem of pageItems) {
            const item = getItemById(invItem.itemId);
            if (!item) continue;

            const currentEnchants = getItemEnchantments(invItem.itemId, player);
            const enchantSlots = getMaxEnchantSlots(item.rarity);
            const cost = calculateEnchantCost(item.rarity, currentEnchants.length);
            const canAfford = player.gold >= cost;

            let enchantText = currentEnchants.length > 0 
                ? currentEnchants.map(e => `• ${e.name} (+${e.bonus})`).join('\n')
                : 'No enchantments';

            embed.addFields({
                name: `${getRarityEmoji(item.rarity)} ${item.name} ${canAfford ? '✅' : '❌'}`,
                value: `**Enchantments (${currentEnchants.length}/${enchantSlots}):**\n${enchantText}\n**Cost:** ${formatNumber(cost)} gold`,
                inline: false
            });
        }

        return embed;
    };

    const generateButtons = (page: number) => {
        const buttons = [
            new ButtonBuilder()
                .setCustomId('enchant_prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('enchant_next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        ];

        // Add enchant buttons for current page items
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = enchantableItems.slice(start, end);

        for (let i = 0; i < Math.min(2, pageItems.length); i++) {
            const item = getItemById(pageItems[i].itemId);
            if (item) {
                const currentEnchants = getItemEnchantments(pageItems[i].itemId, player);
                const maxSlots = getMaxEnchantSlots(item.rarity);
                
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`enchant_item_${start + i}`)
                        .setLabel(`✨ ${item.name}`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentEnchants.length >= maxSlots)
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

        if (interaction.customId === 'enchant_prev' && currentPage > 0) {
            currentPage--;
        } else if (interaction.customId === 'enchant_next' && currentPage < totalPages - 1) {
            currentPage++;
        } else if (interaction.customId.startsWith('enchant_item_')) {
            const itemIndex = parseInt(interaction.customId.split('_')[2]);
            const item = enchantableItems[itemIndex];
            if (item) {
                const itemData = getItemById(item.itemId);
                if (itemData) {
                    await showEnchantmentSelection(response, player, itemData);
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

async function attemptEnchant(message: any, player: any, itemName: string) {
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

    await showEnchantmentSelection(message, player, item);
}

async function showEnchantmentSelection(message: any, player: any, item: any) {
    const currentEnchants = getItemEnchantments(item.id, player);
    const maxSlots = getMaxEnchantSlots(item.rarity);

    if (currentEnchants.length >= maxSlots) {
        return message.reply(`❌ ${item.name} has reached maximum enchantments (${maxSlots})!`);
    }

    const availableEnchants = getAvailableEnchantments(item.type, currentEnchants);
    const cost = calculateEnchantCost(item.rarity, currentEnchants.length);

    if (player.gold < cost) {
        return message.reply(`❌ You need ${formatNumber(cost)} gold to enchant this item!`);
    }

    const embed = new EmbedBuilder()
        .setTitle(`✨ Enchant ${item.name}`)
        .setDescription('Choose an enchantment to add:')
        .addFields(
            { name: '💰 Cost', value: formatNumber(cost), inline: true },
            { name: '🎰 Success Rate', value: '85%', inline: true },
            { name: '📊 Current Enchantments', value: `${currentEnchants.length}/${maxSlots}`, inline: true }
        )
        .setColor(0x9400d3);

    let enchantText = '';
    for (let i = 0; i < availableEnchants.length; i++) {
        const enchant = availableEnchants[i];
        enchantText += `${i + 1}. **${enchant.name}** - ${enchant.description}\n`;
    }

    embed.addFields({
        name: '🔮 Available Enchantments',
        value: enchantText || 'No enchantments available',
        inline: false
    });

    const buttons = [];
    for (let i = 0; i < Math.min(4, availableEnchants.length); i++) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`enchant_select_${i}`)
                .setLabel(`${i + 1}. ${availableEnchants[i].name}`)
                .setStyle(ButtonStyle.Primary)
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setCustomId('enchant_cancel')
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    const response = await message.edit({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 60000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        if (interaction.customId === 'enchant_cancel') {
            const cancelEmbed = new EmbedBuilder()
                .setTitle('❌ Enchantment Cancelled')
                .setDescription('You decided not to enchant the item.')
                .setColor(0xff0000);

            await response.edit({ embeds: [cancelEmbed], components: [] });
        } else if (interaction.customId.startsWith('enchant_select_')) {
            const enchantIndex = parseInt(interaction.customId.split('_')[2]);
            const selectedEnchant = availableEnchants[enchantIndex];
            if (selectedEnchant) {
                await executeEnchantment(response, player, item, selectedEnchant, cost);
            }
        }
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            response.edit({ components: [] });
        }
    });
}

async function executeEnchantment(message: any, player: any, item: any, enchantment: any, cost: number) {
    const successRoll = Math.random() * 100;
    const isSuccess = successRoll <= 85; // 85% success rate

    const newGold = player.gold - cost;

    if (isSuccess) {
        // Add enchantment
        await addItemEnchantment(player.discordId, item.id, enchantment);

        const xpGain = cost / 10;
        await updatePlayer(player.discordId, {
            gold: newGold,
            xp: player.xp + xpGain
        });

        const successEmbed = new EmbedBuilder()
            .setTitle('✨ Enchantment Successful!')
            .setDescription(`Successfully enchanted **${item.name}**!`)
            .addFields(
                { name: '🔮 Enchantment Added', value: `${enchantment.name} (+${enchantment.bonus})`, inline: true },
                { name: '💰 Gold Spent', value: formatNumber(cost), inline: true },
                { name: '⭐ XP Gained', value: `${Math.floor(xpGain)}`, inline: true },
                { name: '💵 Gold Remaining', value: formatNumber(newGold), inline: true },
                { name: '✨ Effect', value: enchantment.description, inline: false }
            )
            .setColor(0x00ff00)
            .setFooter({ text: item.plaggComment || 'The magic flows through the item!' });

        await message.edit({ embeds: [successEmbed], components: [] });

    } else {
        // Enchantment failed
        await updatePlayer(player.discordId, {
            gold: newGold
        });

        const failureEmbed = new EmbedBuilder()
            .setTitle('💫 Enchantment Failed')
            .setDescription(`The enchantment failed, but **${item.name}** was not damaged.`)
            .addFields(
                { name: '💸 Gold Lost', value: formatNumber(cost), inline: true },
                { name: '💵 Gold Remaining', value: formatNumber(newGold), inline: true },
                { name: '🔄 Try Again', value: 'The item can still be enchanted!', inline: false }
            )
            .setColor(0xff8000)
            .setFooter({ text: 'Better luck next time!' });

        await message.edit({ embeds: [failureEmbed], components: [] });
    }
}

function getItemEnchantments(itemId: string, player: any): any[] {
    // In a real implementation, this would be stored in the database
    // For now, return empty array as placeholder
    return [];
}

function getMaxEnchantSlots(rarity: string): number {
    const slots: Record<string, number> = {
        'common': 1,
        'uncommon': 2,
        'rare': 3,
        'epic': 4,
        'legendary': 5,
        'mythic': 6
    };
    return slots[rarity] || 1;
}

function calculateEnchantCost(rarity: string, currentEnchants: number): number {
    const baseCosts: Record<string, number> = {
        'common': 1000,
        'uncommon': 2000,
        'rare': 4000,
        'epic': 8000,
        'legendary': 16000,
        'mythic': 32000
    };
    
    const baseCost = baseCosts[rarity] || 1000;
    return Math.floor(baseCost * Math.pow(2, currentEnchants));
}

function getAvailableEnchantments(itemType: string, currentEnchants: any[]): any[] {
    const allEnchantments = {
        weapon: [
            { id: 'sharpness', name: 'Sharpness', description: 'Increases weapon damage', bonus: 'DMG +15%' },
            { id: 'critical', name: 'Critical Strike', description: 'Increases critical hit chance', bonus: 'CRIT +10%' },
            { id: 'vampiric', name: 'Vampiric', description: 'Heals user on hit', bonus: 'Lifesteal 5%' },
            { id: 'elemental_fire', name: 'Fire Enchantment', description: 'Adds fire damage', bonus: 'Fire DMG +20' },
            { id: 'elemental_ice', name: 'Ice Enchantment', description: 'Chance to freeze enemies', bonus: 'Freeze 15%' }
        ],
        armor: [
            { id: 'protection', name: 'Protection', description: 'Reduces incoming damage', bonus: 'DEF +20%' },
            { id: 'regeneration', name: 'Regeneration', description: 'Slowly restores HP', bonus: 'HP Regen +5/min' },
            { id: 'resistance', name: 'Magic Resistance', description: 'Reduces magic damage', bonus: 'Magic DEF +25%' },
            { id: 'thorns', name: 'Thorns', description: 'Reflects damage to attackers', bonus: 'Reflect 10%' },
            { id: 'fortification', name: 'Fortification', description: 'Increases maximum HP', bonus: 'Max HP +50' }
        ],
        accessory: [
            { id: 'luck', name: 'Fortune', description: 'Increases gold and drop rates', bonus: 'Drop Rate +25%' },
            { id: 'experience', name: 'Wisdom', description: 'Increases XP gain', bonus: 'XP Gain +15%' },
            { id: 'speed', name: 'Swiftness', description: 'Increases movement speed', bonus: 'SPD +10' },
            { id: 'mana_boost', name: 'Arcane Power', description: 'Increases maximum MP', bonus: 'Max MP +30' },
            { id: 'stat_boost', name: 'Enhancement', description: 'Boosts all stats', bonus: 'All Stats +5' }
        ]
    };

    const typeEnchants = allEnchantments[itemType as keyof typeof allEnchantments] || [];
    const usedEnchantIds = currentEnchants.map(e => e.id);
    
    return typeEnchants.filter(enchant => !usedEnchantIds.includes(enchant.id));
}

async function addItemEnchantment(playerId: string, itemId: string, enchantment: any) {
    // In a real implementation, this would update the database
    // For now, this is a placeholder
    console.log(`Added enchantment ${enchantment.name} to ${itemId} for player ${playerId}`);
}

export default command;
