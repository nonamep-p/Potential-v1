import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command, InventoryItem } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { getAllWeapons, getAllArmor, getAllConsumables, getRarityEmoji, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'shop',
    description: 'Browse and buy items from the shop',
    usage: '$shop [category]',
    category: 'economy',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const category = args[0]?.toLowerCase() || 'main';

        switch (category) {
            case 'weapons':
                await showWeaponsShop(message, player);
                break;
            case 'armor':
                await showArmorShop(message, player);
                break;
            case 'consumables':
                await showConsumablesShop(message, player);
                break;
            default:
                await showMainShop(message, player);
                break;
        }
    }
};

async function showMainShop(message: any, player: any) {
    const embed = new EmbedBuilder()
        .setTitle('🏪 Adventurer\'s Shop')
        .setDescription('Welcome to the shop! What would you like to browse?')
        .addFields(
            { name: '⚔️ Weapons', value: 'Swords, staffs, bows and more', inline: true },
            { name: '🛡️ Armor', value: 'Protective gear and clothing', inline: true },
            { name: '🧪 Consumables', value: 'Potions, food, and utilities', inline: true },
            { name: '💰 Your Gold', value: formatNumber(player.gold), inline: false }
        )
        .setColor(0x8b4513)
        .setFooter({ text: 'Select a category to browse items!' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('shop_weapons')
                .setLabel('⚔️ Weapons')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('shop_armor')
                .setLabel('🛡️ Armor')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('shop_consumables')
                .setLabel('🧪 Consumables')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('shop_close')
                .setLabel('❌ Close')
                .setStyle(ButtonStyle.Danger)
        );

    const response = await message.reply({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 60000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        switch (interaction.customId) {
            case 'shop_weapons':
                await showWeaponsShop(response, player);
                break;
            case 'shop_armor':
                await showArmorShop(response, player);
                break;
            case 'shop_consumables':
                await showConsumablesShop(response, player);
                break;
            case 'shop_close':
                const closeEmbed = new EmbedBuilder()
                    .setTitle('👋 Thanks for visiting!')
                    .setDescription('Come back anytime to browse our wares!')
                    .setColor(0x00ff00);
                
                await response.edit({ embeds: [closeEmbed], components: [] });
                break;
        }
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function showWeaponsShop(message: any, player: any) {
    const weapons = getAllWeapons().filter(w => w.value <= player.gold * 2); // Show affordable items
    const shopWeapons = weapons.slice(0, 8); // Limit to 8 items

    const embed = new EmbedBuilder()
        .setTitle('⚔️ Weapon Shop')
        .setDescription('Choose your weapon wisely!')
        .setColor(0x8b4513)
        .addFields({ name: '💰 Your Gold', value: formatNumber(player.gold), inline: false });

    let description = '';
    for (let i = 0; i < shopWeapons.length; i++) {
        const weapon = shopWeapons[i];
        const emoji = getRarityEmoji(weapon.rarity);
        const affordable = player.gold >= weapon.value ? '✅' : '❌';
        description += `${i + 1}. ${emoji} **${weapon.name}** - ${weapon.value} Gold ${affordable}\n`;
    }

    embed.addFields({ name: '🗡️ Available Weapons', value: description || 'No weapons available', inline: false });

    const row1 = new ActionRowBuilder<ButtonBuilder>();
    const row2 = new ActionRowBuilder<ButtonBuilder>();

    for (let i = 0; i < Math.min(4, shopWeapons.length); i++) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`buy_weapon_${i}`)
                .setLabel(`${i + 1}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(player.gold < shopWeapons[i].value)
        );
    }

    for (let i = 4; i < Math.min(8, shopWeapons.length); i++) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`buy_weapon_${i}`)
                .setLabel(`${i + 1}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(player.gold < shopWeapons[i].value)
        );
    }

    row2.addComponents(
        new ButtonBuilder()
            .setCustomId('shop_back')
            .setLabel('🔙 Back')
            .setStyle(ButtonStyle.Secondary)
    );

    const components = [row1];
    if (row2.components.length > 1) components.push(row2);
    else components[0].addComponents(row2.components[0]);

    const response = await message.edit({ embeds: [embed], components });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 60000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        if (interaction.customId === 'shop_back') {
            await showMainShop(response, player);
            return;
        }

        if (interaction.customId.startsWith('buy_weapon_')) {
            const index = parseInt(interaction.customId.split('_')[2]);
            const weapon = shopWeapons[index];
            
            if (!weapon || player.gold < weapon.value) {
                await interaction.followUp({
                    content: '❌ You cannot afford this item!',
                    ephemeral: true
                });
                return;
            }

            await purchaseItem(interaction, player, weapon);
        }
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function showArmorShop(message: any, player: any) {
    const armor = getAllArmor().filter(a => a.value <= player.gold * 2);
    const shopArmor = armor.slice(0, 8);

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Armor Shop')
        .setDescription('Protect yourself with quality armor!')
        .setColor(0x8b4513)
        .addFields({ name: '💰 Your Gold', value: formatNumber(player.gold), inline: false });

    let description = '';
    for (let i = 0; i < shopArmor.length; i++) {
        const armorPiece = shopArmor[i];
        const emoji = getRarityEmoji(armorPiece.rarity);
        const affordable = player.gold >= armorPiece.value ? '✅' : '❌';
        description += `${i + 1}. ${emoji} **${armorPiece.name}** - ${armorPiece.value} Gold ${affordable}\n`;
    }

    embed.addFields({ name: '🛡️ Available Armor', value: description || 'No armor available', inline: false });

    // Similar button setup as weapons...
    await message.edit({ embeds: [embed], components: [] });
}

async function showConsumablesShop(message: any, player: any) {
    const consumables = getAllConsumables().filter(c => c.value <= player.gold * 2);
    const shopConsumables = consumables.slice(0, 8);

    const embed = new EmbedBuilder()
        .setTitle('🧪 Consumables Shop')
        .setDescription('Stock up on useful items!')
        .setColor(0x8b4513)
        .addFields({ name: '💰 Your Gold', value: formatNumber(player.gold), inline: false });

    let description = '';
    for (let i = 0; i < shopConsumables.length; i++) {
        const item = shopConsumables[i];
        const emoji = getRarityEmoji(item.rarity);
        const affordable = player.gold >= item.value ? '✅' : '❌';
        description += `${i + 1}. ${emoji} **${item.name}** - ${item.value} Gold ${affordable}\n`;
    }

    embed.addFields({ name: '🧪 Available Items', value: description || 'No items available', inline: false });

    await message.edit({ embeds: [embed], components: [] });
}

async function purchaseItem(interaction: any, player: any, item: any) {
    // Update player gold and inventory
    const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
    const existingItem = inventory.find(i => i.itemId === item.id);

    if (existingItem && item.stackable) {
        existingItem.quantity += 1;
    } else {
        inventory.push({ itemId: item.id, quantity: 1 });
    }

    await updatePlayer(player.discordId, {
        gold: player.gold - item.value,
        inventoryJson: JSON.stringify(inventory)
    });

    const embed = new EmbedBuilder()
        .setTitle('✅ Purchase Successful!')
        .setDescription(`You bought **${item.name}** for ${item.value} gold!`)
        .addFields(
            { name: '🎉 Item Acquired', value: item.name, inline: true },
            { name: '💰 Gold Spent', value: `${item.value}`, inline: true },
            { name: '💵 Remaining Gold', value: `${player.gold - item.value}`, inline: true }
        )
        .setColor(0x00ff00);

    await interaction.followUp({ embeds: [embed], ephemeral: true });
}

export default command;
