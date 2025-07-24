import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command, InventoryItem } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { getItemById, getRarityEmoji, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'craft',
    description: 'Craft consumables and utility items',
    usage: '$craft [recipe_name]',
    category: 'items',
    cooldown: 60,
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 5) {
            return message.reply('❌ You need to be level 5 or higher to craft items!');
        }

        if (args.length === 0) {
            await showCraftMenu(message, player);
        } else {
            const recipeName = args.join(' ').toLowerCase();
            await attemptCraft(message, player, recipeName);
        }
    }
};

async function showCraftMenu(message: any, player: any) {
    const recipes = getCraftRecipes();
    const availableRecipes = recipes.filter(recipe => 
        recipe.levelRequirement <= player.level
    );

    if (availableRecipes.length === 0) {
        return message.reply('❌ No craft recipes available for your level!');
    }

    let currentPage = 0;
    const recipesPerPage = 6;
    const totalPages = Math.ceil(availableRecipes.length / recipesPerPage);

    const generateEmbed = (page: number) => {
        const start = page * recipesPerPage;
        const end = start + recipesPerPage;
        const pageRecipes = availableRecipes.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle('🛠️ Crafting Workshop')
            .setDescription('Create useful consumables and items!')
            .setColor(0x32cd32)
            .setFooter({ text: `Page ${page + 1}/${totalPages} | Your Gold: ${formatNumber(player.gold)}` });

        for (const recipe of pageRecipes) {
            const canAfford = player.gold >= recipe.cost;
            const canCraft = hasRequiredMaterials(player, recipe.materials);
            const statusEmoji = canAfford && canCraft ? '✅' : '❌';

            let materialsText = recipe.materials.map(mat => 
                `${mat.quantity}x ${mat.name}`
            ).join(', ');

            embed.addFields({
                name: `${getRarityEmoji(recipe.rarity)} ${recipe.name} ${statusEmoji}`,
                value: `**Effect:** ${recipe.effect}\n**Materials:** ${materialsText}\n**Cost:** ${recipe.cost} gold`,
                inline: true
            });
        }

        return embed;
    };

    const generateButtons = (page: number) => {
        const buttons = [
            new ButtonBuilder()
                .setCustomId('craft_prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('craft_next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        ];

        // Add quick craft buttons for current page recipes
        const start = page * recipesPerPage;
        const end = start + recipesPerPage;
        const pageRecipes = availableRecipes.slice(start, end);

        for (let i = 0; i < Math.min(3, pageRecipes.length); i++) {
            const recipe = pageRecipes[i];
            const canCraft = player.gold >= recipe.cost && hasRequiredMaterials(player, recipe.materials);
            
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`craft_recipe_${start + i}`)
                    .setLabel(`🛠️ ${recipe.name}`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!canCraft)
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

        if (interaction.customId === 'craft_prev' && currentPage > 0) {
            currentPage--;
        } else if (interaction.customId === 'craft_next' && currentPage < totalPages - 1) {
            currentPage++;
        } else if (interaction.customId.startsWith('craft_recipe_')) {
            const recipeIndex = parseInt(interaction.customId.split('_')[2]);
            const recipe = availableRecipes[recipeIndex];
            if (recipe) {
                await executeCraft(response, player, recipe);
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

async function attemptCraft(message: any, player: any, recipeName: string) {
    const recipes = getCraftRecipes();
    const recipe = recipes.find(r => 
        r.name.toLowerCase().includes(recipeName) ||
        r.id.toLowerCase().includes(recipeName)
    );

    if (!recipe) {
        return message.reply('❌ Recipe not found! Use `$craft` to see available recipes.');
    }

    if (player.level < recipe.levelRequirement) {
        return message.reply(`❌ You need to be level ${recipe.levelRequirement} to craft ${recipe.name}!`);
    }

    if (player.gold < recipe.cost) {
        return message.reply(`❌ You need ${formatNumber(recipe.cost)} gold to craft ${recipe.name}!`);
    }

    if (!hasRequiredMaterials(player, recipe.materials)) {
        const missing = getMissingMaterials(player, recipe.materials);
        return message.reply(`❌ Missing materials: ${missing.join(', ')}`);
    }

    await executeCraft(message, player, recipe);
}

async function executeCraft(message: any, player: any, recipe: any) {
    let updatedInventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');

    // Remove materials and gold
    for (const material of recipe.materials) {
        const inventoryItem = updatedInventory.find(item => item.itemId === material.id);
        if (inventoryItem) {
            inventoryItem.quantity -= material.quantity;
            if (inventoryItem.quantity <= 0) {
                updatedInventory = updatedInventory.filter(item => item.itemId !== material.id);
            }
        }
    }

    // Add crafted item
    const existingItem = updatedInventory.find(item => item.itemId === recipe.resultItemId);
    if (existingItem) {
        existingItem.quantity += recipe.quantity || 1;
    } else {
        updatedInventory.push({ 
            itemId: recipe.resultItemId, 
            quantity: recipe.quantity || 1 
        });
    }

    // Calculate XP gain
    const xpGain = recipe.levelRequirement * 15;
    const newGold = player.gold - recipe.cost;

    await updatePlayer(player.discordId, {
        gold: newGold,
        inventoryJson: JSON.stringify(updatedInventory),
        xp: player.xp + xpGain
    });

    const craftedItem = getItemById(recipe.resultItemId);
    const successEmbed = new EmbedBuilder()
        .setTitle('🎉 Crafting Successful!')
        .setDescription(`You successfully crafted **${recipe.name}**!`)
        .addFields(
            { name: '✨ Item Created', value: `${getRarityEmoji(recipe.rarity)} ${recipe.name}`, inline: true },
            { name: '📦 Quantity', value: `${recipe.quantity || 1}`, inline: true },
            { name: '⭐ XP Gained', value: `${xpGain}`, inline: true },
            { name: '💵 Gold Remaining', value: formatNumber(newGold), inline: true },
            { name: '🔮 Effect', value: recipe.effect, inline: false }
        )
        .setColor(0x00ff00)
        .setFooter({ text: craftedItem?.plaggComment || 'A fine creation!' });

    await message.edit({ embeds: [successEmbed], components: [] });
}

function hasRequiredMaterials(player: any, requiredMaterials: any[]): boolean {
    const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
    
    for (const material of requiredMaterials) {
        const inventoryItem = inventory.find(item => item.itemId === material.id);
        if (!inventoryItem || inventoryItem.quantity < material.quantity) {
            return false;
        }
    }
    
    return true;
}

function getMissingMaterials(player: any, requiredMaterials: any[]): string[] {
    const inventory: InventoryItem[] = JSON.parse(player.inventoryJson || '[]');
    const missing = [];
    
    for (const material of requiredMaterials) {
        const inventoryItem = inventory.find(item => item.itemId === material.id);
        const needed = material.quantity - (inventoryItem?.quantity || 0);
        if (needed > 0) {
            missing.push(`${needed}x ${material.name}`);
        }
    }
    
    return missing;
}

function getCraftRecipes() {
    return [
        {
            id: 'health_potion',
            name: 'Health Potion',
            rarity: 'common',
            cost: 50,
            levelRequirement: 5,
            quantity: 3,
            effect: 'Restores 50 HP',
            resultItemId: 'health_potion',
            materials: [
                { id: 'red_herb', name: 'Red Herb', quantity: 2 },
                { id: 'spring_water', name: 'Spring Water', quantity: 1 }
            ]
        },
        {
            id: 'mana_potion',
            name: 'Mana Potion',
            rarity: 'common',
            cost: 75,
            levelRequirement: 8,
            quantity: 3,
            effect: 'Restores 30 MP',
            resultItemId: 'mana_potion',
            materials: [
                { id: 'blue_herb', name: 'Blue Herb', quantity: 2 },
                { id: 'magic_dust', name: 'Magic Dust', quantity: 1 }
            ]
        },
        {
            id: 'strength_elixir',
            name: 'Strength Elixir',
            rarity: 'uncommon',
            cost: 200,
            levelRequirement: 12,
            quantity: 1,
            effect: 'Temporarily increases STR by 5 for 1 hour',
            resultItemId: 'strength_elixir',
            materials: [
                { id: 'tiger_claw', name: 'Tiger Claw', quantity: 1 },
                { id: 'power_crystal', name: 'Power Crystal', quantity: 1 },
                { id: 'rare_water', name: 'Rare Water', quantity: 1 }
            ]
        },
        {
            id: 'wisdom_potion',
            name: 'Wisdom Potion',
            rarity: 'uncommon',
            cost: 250,
            levelRequirement: 15,
            quantity: 1,
            effect: 'Temporarily increases INT by 5 for 1 hour',
            resultItemId: 'wisdom_potion',
            materials: [
                { id: 'owl_feather', name: 'Owl Feather', quantity: 1 },
                { id: 'knowledge_crystal', name: 'Knowledge Crystal', quantity: 1 },
                { id: 'ancient_ink', name: 'Ancient Ink', quantity: 1 }
            ]
        },
        {
            id: 'fortification_draught',
            name: 'Fortification Draught',
            rarity: 'rare',
            cost: 500,
            levelRequirement: 20,
            quantity: 1,
            effect: 'Temporarily increases DEF by 8 for 2 hours',
            resultItemId: 'fortification_draught',
            materials: [
                { id: 'stone_essence', name: 'Stone Essence', quantity: 2 },
                { id: 'diamond_dust', name: 'Diamond Dust', quantity: 1 },
                { id: 'guardian_blessing', name: 'Guardian Blessing', quantity: 1 }
            ]
        },
        {
            id: 'haste_potion',
            name: 'Haste Potion',
            rarity: 'rare',
            cost: 450,
            levelRequirement: 18,
            quantity: 1,
            effect: 'Temporarily increases SPD by 7 for 2 hours',
            resultItemId: 'haste_potion',
            materials: [
                { id: 'wind_essence', name: 'Wind Essence', quantity: 2 },
                { id: 'lightning_shard', name: 'Lightning Shard', quantity: 1 },
                { id: 'mercury_drop', name: 'Mercury Drop', quantity: 1 }
            ]
        },
        {
            id: 'greater_healing_potion',
            name: 'Greater Healing Potion',
            rarity: 'rare',
            cost: 800,
            levelRequirement: 25,
            quantity: 2,
            effect: 'Restores 150 HP instantly',
            resultItemId: 'greater_healing_potion',
            materials: [
                { id: 'phoenix_feather', name: 'Phoenix Feather', quantity: 1 },
                { id: 'life_crystal', name: 'Life Crystal', quantity: 1 },
                { id: 'holy_water', name: 'Holy Water', quantity: 2 }
            ]
        },
        {
            id: 'superior_mana_elixir',
            name: 'Superior Mana Elixir',
            rarity: 'epic',
            cost: 1200,
            levelRequirement: 30,
            quantity: 1,
            effect: 'Restores 100 MP and grants +10 INT for 3 hours',
            resultItemId: 'superior_mana_elixir',
            materials: [
                { id: 'ether_crystal', name: 'Ether Crystal', quantity: 2 },
                { id: 'arcane_essence', name: 'Arcane Essence', quantity: 1 },
                { id: 'void_water', name: 'Void Water', quantity: 1 }
            ]
        },
        {
            id: 'elixir_of_power',
            name: 'Elixir of Power',
            rarity: 'legendary',
            cost: 3000,
            levelRequirement: 40,
            quantity: 1,
            effect: 'Increases all stats by 10 for 6 hours',
            resultItemId: 'elixir_of_power',
            materials: [
                { id: 'dragon_blood', name: 'Dragon Blood', quantity: 1 },
                { id: 'philosopher_stone', name: 'Philosopher Stone', quantity: 1 },
                { id: 'ambrosia', name: 'Ambrosia', quantity: 1 }
            ]
        }
    ];
}

export default command;
