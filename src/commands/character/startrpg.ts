import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { loadGameData } from '../../utils/gameUtils.js';

const startrpg: Command = {
  name: 'startrpg',
  description: 'Begin your Isekai adventure in the world of Plagg RPG',
  category: 'character',
  
  async execute(message: Message, args: string[]) {
    try {
      const userId = message.author.id;
      const username = message.author.username;
      
      // Check if player already exists
      const existingPlayer = await DatabaseHelpers.prisma.player.findUnique({
        where: { discordId: userId }
      });
      
      if (existingPlayer) {
        const embed = GameEmbedBuilder.createWarningEmbed(
          `You've already begun your adventure, ${username}! Use \`$profile\` to view your progress.`
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Load game data to get starting items
      const gameData = await loadGameData();
      const starterClass = gameData.classes.find(c => c.id === 'adventurer');
      
      if (!starterClass) {
        throw new Error('Starting class not found in game data');
      }
      
      // Create new player with starter equipment
      const starterInventory = [
        { itemId: 'beginner_sword', quantity: 1, enchantLevel: 0 },
        { itemId: 'leather_armor', quantity: 1, enchantLevel: 0 },
        { itemId: 'health_potion', quantity: 3, enchantLevel: 0 },
      ];
      
      const starterEquipment = {
        weapon: 'beginner_sword',
        chest: 'leather_armor',
      };
      
      const newPlayer = await DatabaseHelpers.prisma.player.create({
        data: {
          discordId: userId,
          username: username,
          level: 1,
          xp: 0,
          gold: 100,
          elo: 1000,
          className: starterClass.name,
          inventoryJson: JSON.stringify(starterInventory),
          equipmentJson: JSON.stringify(starterEquipment),
          health: 100,
          maxHealth: 100,
          mana: 50,
          maxMana: 50,
          strength: 10 + starterClass.statBonus.strength,
          intelligence: 10 + starterClass.statBonus.intelligence,
          defense: 10 + starterClass.statBonus.defense,
          agility: 10 + starterClass.statBonus.agility,
          luck: 10 + starterClass.statBonus.luck,
        }
      });
      
      // Create welcome embed
      const embed = GameEmbedBuilder.createGameEmbed(
        '🎭 Welcome to Plagg RPG!',
        `Congratulations ${username}! You've been transported to the magical world of Plagg RPG.`,
        0x8B5CF6
      );
      
      embed.addFields(
        {
          name: '🎯 Your Journey Begins',
          value: `**Class:** ${starterClass.name}\n**Level:** ${newPlayer.level}\n**Starting Gold:** ${newPlayer.gold} 🪙`,
          inline: true
        },
        {
          name: '⚔️ Starting Stats',
          value: `**HP:** ${newPlayer.health}/${newPlayer.maxHealth}\n**MP:** ${newPlayer.mana}/${newPlayer.maxMana}\n**STR:** ${newPlayer.strength} | **INT:** ${newPlayer.intelligence}`,
          inline: true
        },
        {
          name: '🎁 Starter Equipment',
          value: `• Beginner's Sword\n• Leather Armor\n• 3x Health Potions`,
          inline: true
        }
      );
      
      embed.addFields({
        name: '📚 Getting Started',
        value: `• Use \`$profile\` to view your stats\n• Use \`$inventory\` to manage items\n• Use \`$help\` for all commands\n• Use \`$dungeon list\` to find adventures`,
        inline: false
      });
      
      // Add Plagg's greeting
      embed.addFields({
        name: '🧀 Plagg\'s Welcome',
        value: `*"Great, another mortal in my domain. Try not to die too quickly - and remember, everything's better with cheese! Now go cause some chaos!"*`,
        inline: false
      });
      
      await message.reply({ embeds: [embed] });
      
      // Check for welcome scenario trigger
      try {
        const scenarios = await checkScenarioTriggers(newPlayer);
        const welcomeScenario = scenarios.find(s => s.id === 'isekai_arrival');
        
        if (welcomeScenario) {
          setTimeout(async () => {
            const scenarioEmbed = GameEmbedBuilder.createGameEmbed(
              '✨ Isekai Scenario Triggered!',
              welcomeScenario.description,
              0xF59E0B
            );
            
            scenarioEmbed.addFields({
              name: '🧀 Plagg\'s Commentary',
              value: `*"${welcomeScenario.plaggComment}"*`,
              inline: false
            });
            
            await message.followUp({ embeds: [scenarioEmbed] });
          }, 2000);
        }
      } catch (error) {
        console.error('Error checking welcome scenarios:', error);
      }
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to start RPG'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

// Helper function to check scenario triggers
async function checkScenarioTriggers(player: any) {
  // This would import from gameUtils, but avoiding circular imports for now
  return [];
}

export default startrpg;
