import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { loadGameData, calculateItemRarity } from '../../utils/gameUtils.js';
import { prisma } from '../../index.js';

const treasure: Command = {
  name: 'treasure',
  description: 'Search for hidden treasures or view your treasure hunting statistics',
  category: 'dungeon',
  cooldown: 300, // 5 minutes
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      
      if (args.length === 0) {
        // Treasure hunt
        await performTreasureHunt(message, player);
        return;
      }
      
      const subcommand = args[0].toLowerCase();
      
      if (subcommand === 'stats') {
        // Show treasure hunting statistics
        const embed = GameEmbedBuilder.createGameEmbed(
          `💎 ${player.username}'s Treasure Stats`,
          'Your treasure hunting achievements and discoveries',
          0xF59E0B
        );
        
        // In a real implementation, these would be tracked in the database
        embed.addFields(
          {
            name: '🏆 Hunting Record',
            value: `**Treasures Found:** 0\n**Rare Discoveries:** 0\n**Legendary Finds:** 0\n**Total Value:** 0 🪙`,
            inline: true
          },
          {
            name: '📊 Success Rate',
            value: `**Hunts Attempted:** 0\n**Success Rate:** 0%\n**Best Find:** None\n**Lucky Streak:** 0`,
            inline: true
          }
        );
        
        embed.addFields({
          name: '🗺️ Exploration Bonus',
          value: `**Areas Explored:** 0\n**Hidden Locations:** 0\n**Secret Rooms:** 0`,
          inline: false
        });
        
        embed.addFields({
          name: '🧀 Plagg\'s Treasure Assessment',
          value: `*"Your treasure collection is emptier than my stomach after a cheese fast. Time to get hunting!"*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        
      } else if (subcommand === 'hunt') {
        // Alternative way to trigger treasure hunt
        await performTreasureHunt(message, player);
        
      } else if (subcommand === 'map') {
        // Show treasure map or locations
        const embed = GameEmbedBuilder.createGameEmbed(
          '🗺️ Treasure Map',
          'Known treasure hunting locations',
          0xF59E0B
        );
        
        const locations = [
          {
            name: 'Abandoned Cheese Mine',
            difficulty: 'Easy',
            description: 'Old mining tunnels filled with forgotten treasures',
            chance: '70%'
          },
          {
            name: 'Sunken Dairy Ship',
            difficulty: 'Medium',
            description: 'A merchant vessel lost beneath the waves',
            chance: '50%'
          },
          {
            name: 'Dragon\'s Cheese Hoard',
            difficulty: 'Hard',
            description: 'The legendary treasure vault of Ancient Dragon Gruyere',
            chance: '30%'
          },
          {
            name: 'Plagg\'s Secret Stash',
            difficulty: 'Mythic',
            description: 'Hidden caches of cheese and magical artifacts',
            chance: '10%'
          }
        ];
        
        locations.forEach((location, index) => {
          embed.addFields({
            name: `${index + 1}. ${location.name}`,
            value: `**Difficulty:** ${location.difficulty} | **Success Chance:** ${location.chance}\n${location.description}`,
            inline: false
          });
        });
        
        embed.addFields({
          name: '💡 Treasure Hunting Tips',
          value: '• Higher level increases success chance\n• Luck stat affects treasure quality\n• Some locations require special items\n• Cooldown prevents over-hunting',
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        
      } else {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'Invalid treasure command! Use:\n• `$treasure` - Go treasure hunting\n• `$treasure stats` - View statistics\n• `$treasure map` - View locations'
        );
        await message.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to process treasure command'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

async function performTreasureHunt(message: Message, player: any) {
  try {
    const gameData = await loadGameData();
    
    // Check if player has enough energy (health)
    if (player.health < 20) {
      const embed = GameEmbedBuilder.createErrorEmbed(
        'You need at least 20 HP to go treasure hunting. Rest or heal first!'
      );
      await message.reply({ embeds: [embed] });
      return;
    }
    
    // Create searching embed
    const searchEmbed = GameEmbedBuilder.createGameEmbed(
      '🔍 Treasure Hunting',
      `${player.username} begins searching for hidden treasures...`,
      0xF59E0B
    );
    
    searchEmbed.addFields({
      name: '🏃‍♂️ Searching...',
      value: 'You explore ancient ruins, forgotten caves, and mysterious locations...',
      inline: false
    });
    
    const searchMessage = await message.reply({ embeds: [searchEmbed] });
    
    // Add suspense delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Calculate success chance based on player stats
    const baseChance = 60;
    const levelBonus = player.level * 2;
    const luckBonus = player.luck * 3;
    const totalChance = Math.min(90, baseChance + levelBonus + luckBonus);
    
    const success = Math.random() * 100 < totalChance;
    
    if (!success) {
      // No treasure found
      const failEmbed = GameEmbedBuilder.createGameEmbed(
        '🚫 Search Complete',
        'Despite your best efforts, you found no treasure this time.',
        0x6B7280
      );
      
      const failReasons = [
        'The old maps led to empty caves',
        'Other treasure hunters got there first',
        'Your shovel broke on the hard ground',
        'A family of angry badgers chased you away',
        'The treasure was just fool\'s gold'
      ];
      
      const failReason = failReasons[Math.floor(Math.random() * failReasons.length)];
      
      failEmbed.addFields({
        name: '😞 What Happened',
        value: failReason,
        inline: false
      });
      
      // Small consolation prize
      const consolationGold = Math.floor(10 + Math.random() * 20);
      await DatabaseHelpers.addGold(player.discordId, consolationGold);
      
      failEmbed.addFields({
        name: '💰 Consolation Prize',
        value: `Found some spare change: ${consolationGold} 🪙`,
        inline: true
      });
      
      // Reduce health slightly
      await DatabaseHelpers.updatePlayerStats(player.discordId, {
        health: { decrement: 10 }
      });
      
      failEmbed.addFields({
        name: '😴 Energy Used',
        value: 'Lost 10 HP from the search effort',
        inline: true
      });
      
      failEmbed.addFields({
        name: '🧀 Plagg\'s Encouragement',
        value: `*"Don't give up! Even I don't find cheese every time I look. Well, actually I do, but that's beside the point!"*`,
        inline: false
      });
      
      await searchMessage.edit({ embeds: [failEmbed] });
      return;
    }
    
    // Success! Determine treasure quality
    const qualityRoll = Math.random() * 100;
    let treasureType = '';
    let goldReward = 0;
    let itemReward: any = null;
    let xpReward = 0;
    
    if (qualityRoll < 50) {
      // Common treasure
      treasureType = 'Small Treasure Cache';
      goldReward = Math.floor(100 + Math.random() * 200);
      xpReward = Math.floor(25 + Math.random() * 25);
    } else if (qualityRoll < 75) {
      // Uncommon treasure
      treasureType = 'Forgotten Chest';
      goldReward = Math.floor(300 + Math.random() * 300);
      xpReward = Math.floor(50 + Math.random() * 50);
      
      // Chance for item
      if (Math.random() < 0.4) {
        const rarity = calculateItemRarity();
        const allItems = [...gameData.weapons, ...gameData.armor, ...gameData.accessories, ...gameData.consumables];
        const itemsOfRarity = allItems.filter(item => item.rarity === rarity);
        if (itemsOfRarity.length > 0) {
          itemReward = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
        }
      }
    } else if (qualityRoll < 90) {
      // Rare treasure
      treasureType = 'Ancient Treasure Vault';
      goldReward = Math.floor(600 + Math.random() * 400);
      xpReward = Math.floor(100 + Math.random() * 100);
      
      // Higher chance for rare items
      const rarity = Math.random() < 0.3 ? 'rare' : Math.random() < 0.6 ? 'uncommon' : 'common';
      const allItems = [...gameData.weapons, ...gameData.armor, ...gameData.accessories, ...gameData.consumables];
      const itemsOfRarity = allItems.filter(item => item.rarity === rarity);
      if (itemsOfRarity.length > 0) {
        itemReward = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
      }
    } else if (qualityRoll < 98) {
      // Epic treasure
      treasureType = 'Legendary Dragon Hoard';
      goldReward = Math.floor(1000 + Math.random() * 1000);
      xpReward = Math.floor(200 + Math.random() * 200);
      
      // Guaranteed good item
      const rarity = Math.random() < 0.2 ? 'epic' : Math.random() < 0.5 ? 'rare' : 'uncommon';
      const allItems = [...gameData.weapons, ...gameData.armor, ...gameData.accessories, ...gameData.consumables];
      const itemsOfRarity = allItems.filter(item => item.rarity === rarity);
      if (itemsOfRarity.length > 0) {
        itemReward = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
      }
    } else {
      // Mythic treasure (2% chance)
      treasureType = 'Plagg\'s Secret Cheese Vault';
      goldReward = Math.floor(2000 + Math.random() * 3000);
      xpReward = Math.floor(500 + Math.random() * 500);
      
      // Guaranteed legendary/mythic item
      const rarity = Math.random() < 0.1 ? 'mythic' : 'legendary';
      const allItems = [...gameData.weapons, ...gameData.armor, ...gameData.accessories, ...gameData.consumables];
      const itemsOfRarity = allItems.filter(item => item.rarity === rarity);
      if (itemsOfRarity.length > 0) {
        itemReward = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
      }
    }
    
    // Award rewards
    await DatabaseHelpers.addGold(player.discordId, goldReward);
    await DatabaseHelpers.addXP(player.discordId, xpReward);
    
    if (itemReward) {
      await DatabaseHelpers.addItemToInventory(player.discordId, itemReward.id, 1);
    }
    
    // Reduce health
    await DatabaseHelpers.updatePlayerStats(player.discordId, {
      health: { decrement: 15 }
    });
    
    // Create success embed
    const successEmbed = GameEmbedBuilder.createGameEmbed(
      '💎 Treasure Discovered!',
      `${player.username} discovered: **${treasureType}**`,
      0x10B981
    );
    
    const treasureDescriptions = {
      'Small Treasure Cache': 'You found a small buried chest with some coins and trinkets.',
      'Forgotten Chest': 'Hidden in the ruins, you discovered an old chest with valuable contents.',
      'Ancient Treasure Vault': 'Deep underground, you uncovered a sealed vault from ages past.',
      'Legendary Dragon Hoard': 'You stumbled upon part of a legendary dragon\'s treasure collection!',
      'Plagg\'s Secret Cheese Vault': 'INCREDIBLE! You found one of Plagg\'s hidden cheese and treasure stashes!'
    };
    
    successEmbed.addFields({
      name: '🎉 Discovery',
      value: treasureDescriptions[treasureType as keyof typeof treasureDescriptions] || 'You found something amazing!',
      inline: false
    });
    
    let rewardText = `**Gold:** ${goldReward.toLocaleString()} 🪙\n**XP:** ${xpReward.toLocaleString()}`;
    if (itemReward) {
      rewardText += `\n**Item:** ${itemReward.name} (${itemReward.rarity})`;
    }
    
    successEmbed.addFields({
      name: '🎁 Rewards',
      value: rewardText,
      inline: true
    });
    
    successEmbed.addFields({
      name: '😴 Energy Cost',
      value: 'Lost 15 HP from the treasure hunt',
      inline: true
    });
    
    // Special Plagg comments based on treasure type
    let plaggComment = '';
    if (treasureType.includes('Plagg')) {
      plaggComment = 'MY CHEESE! I mean... congratulations on finding my totally not secret stash. Enjoy the cheese crumbs!';
    } else if (treasureType.includes('Dragon')) {
      plaggComment = 'Dragon treasure! Almost as good as aged cheese. The dragon probably had excellent taste.';
    } else if (itemReward && itemReward.rarity === 'mythic') {
      plaggComment = 'Mythic treasure! That\'s rarer than finding good cheese in a fast food restaurant!';
    } else {
      const comments = [
        'Not bad for a human! Though it\'s still not cheese...',
        'Treasure hunting is like cheese aging - patience and luck are key!',
        'Good find! You\'re getting better at this whole \'not dying\' thing.',
        'That treasure would buy a lot of camembert. Just saying.',
        'Excellent work! Your treasure sense is almost as good as my cheese sense!'
      ];
      plaggComment = comments[Math.floor(Math.random() * comments.length)];
    }
    
    successEmbed.addFields({
      name: '🧀 Plagg\'s Congratulations',
      value: `*"${plaggComment}"*`,
      inline: false
    });
    
    await searchMessage.edit({ embeds: [successEmbed] });
    
  } catch (error) {
    console.error('Error in treasure hunt:', error);
    throw error;
  }
}

export default treasure;
