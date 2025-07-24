import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command, InventoryItem } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { getItemById, getAllWeapons, getAllArmor, getRarityEmoji, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'forge',
    description: 'Forge new weapons and armor from materials',
    usage: '$forge [recipe_name]',
    category: 'items',
    cooldown: 180, // 3 minutes
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 10) {
            return message.reply('❌ You need to be level 10 or higher to use the forge!');
        }

        if (args.length === 0) {
            await showForgeMenu(message, player);
        } else {
            const recipeName = args.join(' ').toLowerCase();
            await attemptForge(message, player, recipeName);
        }
    }
};

async function showForgeMenu(message: any, player: any) {
    const recipes = getForgeRecipes();
    const availableRecipes = recipes.filter(recipe => 
        recipe.levelRequirement <= player.level
    );

    if (availableRecipes.length === 0) {
        return message.reply('❌ No forge recipes available for your level!');
    }

    let currentPage = 0;
    const recipesPerPage = 5;
    const totalPages = Math.ceil(availableRecipes.length / recipesPerPage);

    const generateEmbed = (page: number) => {
        const start = page * recipesPerPage;
        const end = start + recipesPerPage;
        const pageRecipes = availableRecipes.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle('🔥 Forge Recipes')
            .setDescription('Choose a recipe to forge new equipment!')
            .setColor(0xff4500)
            .setFooter({ text: `Page ${page + 1}/${totalPages} | Your Gold: ${formatNumber(player.gold)}` });

        for (const recipe of pageRecipes) {
            const canAfford = player.gold >= recipe.cost;
            const affordSymbol = canAfford ? '✅' : '❌';
            
            let materialsText = recipe.materials.map(mat => 
                `${mat.quantity}x ${getItemById(mat.itemId)?.name || mat.itemId}`
            ).join(', ');

            embed.addFields({
                name: `${getRarityEmoji(recipe.rarity)} ${recipe.name} ${affordSymbol}`,
                value: `**Cost:** ${recipe.cost} gold\n**Materials:** ${materialsText}\n**Level:** ${recipe.levelRequirement}+`,
                inline: false
            });
        }

        return embed;
    };

    const generateButtons = (page: number) => {
        const buttons = [
            new ButtonBuilder()
                .setCustomId('forge_prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('forge_next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        ];

        // Add quick forge buttons for current page recipes
        const start = page * recipesPerPage;
        const end = start + recipesPerPage;
        const pageRecipes = availableRecipes.slice(start, end);

        for (let i = 0; i < Math.min(2, pageRecipes.length); i++) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`forge_recipe_${start + i}`)
                    .setLabel(`🔨 ${pageRecipes[i].name}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(player.gold < pageRecipes[i].cost)
            );
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

        if (interaction.customId === 'forge_prev' && currentPage > 0) {
            currentPage--;
        } else if (interaction.customId === 'forge_next' && currentPage < totalPages - 1) {
            currentPage++;
        } else if (interaction.customId.startsWith('forge_recipe_')) {
            const recipeIndex = parseInt(interaction.customId.split('_')[2]);
            const recipe = availableRecipes[recipeIndex];
            if (recipe) {
                await attemptForgeRecipe(response, player, recipe);
                return;
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

async function attemptForge(message: any, player: any, recipeName: string) {
    const recipes = getForgeRecipes();
    const recipe = recipes.find(r => 
        r.name.toLowerCase().includes(recipeName) ||
        r.id.toLowerCase().includes(recipeName)
    );

    if (!recipe) {
        return message.reply('❌ Recipe not found! Use `$forge` to see available recipes.');
    }

    await attemptForgeRecipe(message, player, recipe);
}

async function attemptForgeRecipe(message: any, player: any, recipe: any) {
    // Check level requirement
    if (player.level < recipe.levelRequirement) {
        return message.reply(`❌ You need to be level ${recipe.levelRequirement} to forge ${recipe.name}!`);
    }

    // Check gold cost
    if (player.gold < recipe.cost) {
        return message.reply(`❌ You need ${formatNumber(recipe.cost)} gold to forge ${recipe.name}!`);
    }

    // Check materials
    const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
    const missingMaterials = [];

    for (const material of recipe.materials) {
        const inventoryItem = inventory.find(item => item.itemId === material.itemId);
        if (!inventoryItem || inventoryItem.quantity < material.quantity) {
            const itemData = getItemById(material.itemId);
            const needed = material.quantity - (inventoryItem?.quantity || 0);
            missingMaterials.push(`${needed}x ${itemData?.name || material.itemId}`);
        }
    }

    if (missingMaterials.length > 0) {
        return message.reply(`❌ Missing materials: ${missingMaterials.join(', ')}`);
    }

    // Show confirmation
    const confirmEmbed = new EmbedBuilder()
        .setTitle('🔥 Forge Confirmation')
        .setDescription(`Are you sure you want to forge **${recipe.name}**?`)
        .addFields(
            { name: '💰 Cost', value: `${formatNumber(recipe.cost)} gold`, inline: true },
            { name: '📦 Materials', value: recipe.materials.map((mat: any) => `${mat.quantity}x ${getItemById(mat.itemId)?.name}`).join('\n'), inline: false },
            { name: '🎲 Success Rate', value: `${recipe.successRate}%`, inline: true }
        )
        .setColor(0xff4500);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('forge_confirm')
                .setLabel('🔨 Forge Item')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('forge_cancel')
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

        if (interaction.customId === 'forge_confirm') {
            await executeForge(response, player, recipe);
        } else {
            const cancelEmbed = new EmbedBuilder()
                .setTitle('❌ Forge Cancelled')
                .setDescription('You decided not to forge the item.')
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

async function executeForge(message: any, player: any, recipe: any) {
    const successRoll = Math.random() * 100;
    const isSuccess = successRoll <= recipe.successRate;

    let updatedInventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');

    // Remove materials and gold regardless of success
    for (const material of recipe.materials) {
        const inventoryItem = updatedInventory.find(item => item.itemId === material.itemId);
        if (inventoryItem) {
            inventoryItem.quantity -= material.quantity;
            if (inventoryItem.quantity <= 0) {
                updatedInventory = updatedInventory.filter(item => item.itemId !== material.itemId);
            }
        }
    }

    const newGold = player.gold - recipe.cost;

    if (isSuccess) {
        // Add forged item to inventory
        const existingItem = updatedInventory.find(item => item.itemId === recipe.resultItemId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            updatedInventory.push({ itemId: recipe.resultItemId, quantity: 1 });
        }

        // Give bonus XP for successful forge
        const xpGain = recipe.levelRequirement * 10;

        await updatePlayer(player.discordId, {
            gold: newGold,
            inventoryJson: JSON.stringify(updatedInventory),
            xp: player.xp + xpGain
        });

        const forgedItem = getItemById(recipe.resultItemId);
        const successEmbed = new EmbedBuilder()
            .setTitle('🎉 Forge Successful!')
            .setDescription(`You successfully forged **${recipe.name}**!`)
            .addFields(
                { name: '✨ Item Created', value: `${getRarityEmoji(forgedItem?.rarity)} ${forgedItem?.name}`, inline: true },
                { name: '⭐ XP Gained', value: `${xpGain}`, inline: true },
                { name: '💵 Gold Remaining', value: formatNumber(newGold), inline: true }
            )
            .setColor(0x00ff00)
            .setFooter({ text: forgedItem?.plaggComment || 'A fine creation!' });

        await message.edit({ embeds: [successEmbed], components: [] });

    } else {
        // Forge failed - only remove materials and gold
        await updatePlayer(player.discordId, {
            gold: newGold,
            inventoryJson: JSON.stringify(updatedInventory)
        });

        const failureEmbed = new EmbedBuilder()
            .setTitle('💥 Forge Failed!')
            .setDescription('The forge consumed your materials but produced nothing...')
            .addFields(
                { name: '💸 Materials Lost', value: recipe.materials.map((mat: any) => `${mat.quantity}x ${getItemById(mat.itemId)?.name}`).join('\n'), inline: false },
                { name: '💰 Gold Lost', value: formatNumber(recipe.cost), inline: true },
                { name: '💵 Gold Remaining', value: formatNumber(newGold), inline: true }
            )
            .setColor(0xff0000)
            .setFooter({ text: 'Better luck next time! Higher level recipes have better success rates.' });

        await message.edit({ embeds: [failureEmbed], components: [] });
    }
}

function getForgeRecipes() {
    return [
        {
            id: 'iron_sword',
            name: 'Iron Sword',
            rarity: 'uncommon',
            cost: 500,
            levelRequirement: 10,
            successRate: 85,
            resultItemId: 'iron_sword',
            materials: [
                { itemId: 'iron_ore', quantity: 3 },
                { itemId: 'leather_strip', quantity: 1 }
            ]
        },
        {
            id: 'steel_armor',
            name: 'Steel Armor',
            rarity: 'rare',
            cost: 1200,
            levelRequirement: 15,
            successRate: 75,
            resultItemId: 'steel_armor',
            materials: [
                { itemId: 'steel_ingot', quantity: 5 },
                { itemId: 'cloth', quantity: 2 }
            ]
        },
        {
            id: 'mystic_blade',
            name: 'Mystic Blade',
            rarity: 'epic',
            cost: 3000,
            levelRequirement: 25,
            successRate: 60,
            resultItemId: 'mystic_blade',
            materials: [
                { itemId: 'mithril_ore', quantity: 3 },
                { itemId: 'magic_crystal', quantity: 2 },
                { itemId: 'ancient_rune', quantity: 1 }
            ]
        },
        {
            id: 'dragon_scale_armor',
            name: 'Dragon Scale Armor',
            rarity: 'legendary',
            cost: 8000,
            levelRequirement: 35,
            successRate: 45,
            resultItemId: 'dragon_scale_armor',
            materials: [
                { itemId: 'dragon_scale', quantity: 10 },
                { itemId: 'phoenix_feather', quantity: 3 },
                { itemId: 'celestial_thread', quantity: 5 }
            ]
        },
        {
            id: 'void_destroyer',
            name: 'Void Destroyer',
            rarity: 'mythic',
            cost: 20000,
            levelRequirement: 50,
            successRate: 30,
            resultItemId: 'void_destroyer',
            materials: [
                { itemId: 'void_essence', quantity: 5 },
                { itemId: 'cosmic_ore', quantity: 3 },
                { itemId: 'star_fragment', quantity: 7 }
            ]
        }
    ];
}

export default command;
