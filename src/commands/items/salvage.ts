import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command, InventoryItem } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { getItemById, getRarityEmoji, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'salvage',
    description: 'Break down items into valuable materials',
    usage: '$salvage [item_name]',
    category: 'items',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 8) {
            return message.reply('❌ You need to be level 8 or higher to salvage items!');
        }

        const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
        const salvageableItems = inventory.filter(invItem => {
            const item = getItemById(invItem.itemId);
            return item && item.type !== 'consumable' && item.rarity !== 'common';
        });

        if (salvageableItems.length === 0) {
            return message.reply('❌ You have no items that can be salvaged! (Only uncommon+ equipment can be salvaged)');
        }

        if (args.length === 0) {
            await showSalvageMenu(message, player, salvageableItems);
        } else {
            const itemName = args.join(' ').toLowerCase();
            await attemptSalvage(message, player, itemName);
        }
    }
};

async function showSalvageMenu(message: any, player: any, salvageableItems: InventoryItem[]) {
    let currentPage = 0;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(salvageableItems.length / itemsPerPage);

    const generateEmbed = (page: number) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = salvageableItems.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle('🔨 Salvage Workshop')
            .setDescription('Break down equipment into valuable materials!')
            .setColor(0x8b4513)
            .setFooter({ text: `Page ${page + 1}/${totalPages} | Salvaging destroys the item permanently` });

        for (const invItem of pageItems) {
            const item = getItemById(invItem.itemId);
            if (!item) continue;

            const materials = getSalvageMaterials(item);
            const materialsText = materials.map(mat => `${mat.quantity}x ${mat.name}`).join(', ');

            embed.addFields({
                name: `${getRarityEmoji(item.rarity)} ${item.name} (x${invItem.quantity})`,
                value: `**Type:** ${item.type}\n**Materials:** ${materialsText}\n**Value:** ${formatNumber(item.value)} gold`,
                inline: false
            });
        }

        return embed;
    };

    const generateButtons = (page: number) => {
        const buttons = [
            new ButtonBuilder()
                .setCustomId('salvage_prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('salvage_next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        ];

        // Add salvage buttons for current page items
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = salvageableItems.slice(start, end);

        for (let i = 0; i < Math.min(2, pageItems.length); i++) {
            const item = getItemById(pageItems[i].itemId);
            if (item) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`salvage_item_${start + i}`)
                        .setLabel(`🔨 ${item.name}`)
                        .setStyle(ButtonStyle.Danger)
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

        if (interaction.customId === 'salvage_prev' && currentPage > 0) {
            currentPage--;
        } else if (interaction.customId === 'salvage_next' && currentPage < totalPages - 1) {
            currentPage++;
        } else if (interaction.customId.startsWith('salvage_item_')) {
            const itemIndex = parseInt(interaction.customId.split('_')[2]);
            const item = salvageableItems[itemIndex];
            if (item) {
                const itemData = getItemById(item.itemId);
                if (itemData) {
                    await attemptSalvageItem(response, player, itemData);
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

async function attemptSalvage(message: any, player: any, itemName: string) {
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

    await attemptSalvageItem(message, player, item);
}

async function attemptSalvageItem(message: any, player: any, item: any) {
    if (item.type === 'consumable') {
        return message.reply('❌ Consumable items cannot be salvaged!');
    }

    if (item.rarity === 'common') {
        return message.reply('❌ Common items cannot be salvaged!');
    }

    const materials = getSalvageMaterials(item);
    const salvageValue = Math.floor(item.value * 0.6); // 60% of item value

    // Show confirmation
    const confirmEmbed = new EmbedBuilder()
        .setTitle('🔨 Salvage Confirmation')
        .setDescription(`Are you sure you want to salvage **${item.name}**?`)
        .addFields(
            { name: '⚠️ Warning', value: 'This will permanently destroy the item!', inline: false },
            { name: '🧱 Materials Gained', value: materials.map(mat => `${mat.quantity}x ${mat.name}`).join('\n'), inline: true },
            { name: '💰 Gold Value', value: formatNumber(salvageValue), inline: true }
        )
        .setColor(0xff4500)
        .setFooter({ text: item.plaggComment || 'Sometimes destruction leads to creation!' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('salvage_confirm')
                .setLabel('🔨 Salvage Item')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('salvage_cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

    const response = await message.edit({ embeds: [confirmEmbed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 30000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        if (interaction.customId === 'salvage_confirm') {
            await executeSalvage(response, player, item, materials, salvageValue);
        } else {
            const cancelEmbed = new EmbedBuilder()
                .setTitle('❌ Salvage Cancelled')
                .setDescription('You decided not to salvage the item.')
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

async function executeSalvage(message: any, player: any, item: any, materials: any[], salvageValue: number) {
    let updatedInventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');

    // Remove the salvaged item
    const itemIndex = updatedInventory.findIndex(invItem => invItem.itemId === item.id);
    if (itemIndex !== -1) {
        updatedInventory[itemIndex].quantity -= 1;
        if (updatedInventory[itemIndex].quantity <= 0) {
            updatedInventory.splice(itemIndex, 1);
        }
    }

    // Add materials to inventory
    for (const material of materials) {
        const existingMaterial = updatedInventory.find(invItem => invItem.itemId === material.id);
        if (existingMaterial) {
            existingMaterial.quantity += material.quantity;
        } else {
            updatedInventory.push({ itemId: material.id, quantity: material.quantity });
        }
    }

    // Add gold and XP
    const xpGain = Math.floor(item.value / 10);
    const newGold = player.gold + salvageValue;

    await updatePlayer(player.discordId, {
        gold: newGold,
        xp: player.xp + xpGain,
        inventoryJson: JSON.stringify(updatedInventory)
    });

    const successEmbed = new EmbedBuilder()
        .setTitle('✅ Salvage Complete!')
        .setDescription(`Successfully salvaged **${item.name}**!`)
        .addFields(
            { name: '🧱 Materials Obtained', value: materials.map(mat => `${mat.quantity}x ${mat.name}`).join('\n'), inline: true },
            { name: '💰 Gold Earned', value: formatNumber(salvageValue), inline: true },
            { name: '⭐ XP Gained', value: `${xpGain}`, inline: true },
            { name: '💵 New Balance', value: formatNumber(newGold), inline: true }
        )
        .setColor(0x00ff00)
        .setFooter({ text: 'Use these materials for crafting and forging!' });

    await message.edit({ embeds: [successEmbed], components: [] });
}

function getSalvageMaterials(item: any) {
    const rarityMaterials: Record<string, any[]> = {
        'uncommon': [
            { id: 'scrap_metal', name: 'Scrap Metal', quantity: 2 },
            { id: 'leather_strip', name: 'Leather Strip', quantity: 1 }
        ],
        'rare': [
            { id: 'iron_ore', name: 'Iron Ore', quantity: 3 },
            { id: 'cloth', name: 'Cloth', quantity: 2 },
            { id: 'magic_dust', name: 'Magic Dust', quantity: 1 }
        ],
        'epic': [
            { id: 'steel_ingot', name: 'Steel Ingot', quantity: 2 },
            { id: 'magic_crystal', name: 'Magic Crystal', quantity: 1 },
            { id: 'rare_gem', name: 'Rare Gem', quantity: 1 }
        ],
        'legendary': [
            { id: 'mithril_ore', name: 'Mithril Ore', quantity: 2 },
            { id: 'ancient_rune', name: 'Ancient Rune', quantity: 1 },
            { id: 'phoenix_feather', name: 'Phoenix Feather', quantity: 1 }
        ],
        'mythic': [
            { id: 'void_essence', name: 'Void Essence', quantity: 1 },
            { id: 'cosmic_ore', name: 'Cosmic Ore', quantity: 1 },
            { id: 'star_fragment', name: 'Star Fragment', quantity: 2 }
        ]
    };

    const baseMaterials = rarityMaterials[item.rarity] || rarityMaterials['uncommon'];
    
    // Add type-specific materials
    const typeMaterials: Record<string, any[]> = {
        'weapon': [{ id: 'weapon_core', name: 'Weapon Core', quantity: 1 }],
        'armor': [{ id: 'armor_plate', name: 'Armor Plate', quantity: 1 }],
        'accessory': [{ id: 'gem_shard', name: 'Gem Shard', quantity: 1 }]
    };

    const typeSpecific = typeMaterials[item.type] || [];
    
    return [...baseMaterials, ...typeSpecific];
}

export default command;
