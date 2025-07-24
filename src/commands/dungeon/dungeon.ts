import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { DungeonRunner } from '../../structures/DungeonRunner.js';
import { loadGameData } from '../../utils/gameUtils.js';
import { prisma } from '../../index.js';

const dungeon: Command = {
  name: 'dungeon',
  description: 'Manage dungeon sessions and view dungeon information',
  category: 'dungeon',
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      const dungeonRunner = new DungeonRunner(prisma);
      const gameData = await loadGameData();
      
      if (args.length === 0) {
        // Show current dungeon status or available commands
        const session = await dungeonRunner.getDungeonSession(player.discordId);
        
        if (session) {
          const dungeon = gameData.dungeons.find(d => d.id === session.dungeonId);
          const progress = JSON.parse(session.progress);
          
          if (!dungeon) {
            const errorEmbed = GameEmbedBuilder.createErrorEmbed(
              'Dungeon data corrupted. Session has been reset.'
            );
            await message.reply({ embeds: [errorEmbed] });
            return;
          }
          
          const embed = GameEmbedBuilder.createDungeonEmbed(
            dungeon,
            progress.currentFloor,
            progress.roomsCleared,
            progress.totalRooms
          );
          
          embed.setTitle(`🏰 Current Dungeon: ${dungeon.name}`);
          
          embed.addFields(
            {
              name: '📊 Session Stats',
              value: `**Floor:** ${progress.currentFloor}/${dungeon.maxFloors}\n**Rooms Cleared:** ${progress.roomsCleared}\n**Treasures Found:** ${progress.treasuresFound.length}`,
              inline: true
            },
            {
              name: '❤️ Current Status',
              value: `**HP:** ${progress.playerHealth}/${player.maxHealth}\n**MP:** ${progress.playerMana}/${player.maxMana}`,
              inline: true
            }
          );
          
          if (progress.currentMonster) {
            embed.addFields({
              name: '⚔️ Active Combat',
              value: `Fighting: **${progress.currentMonster.name}**\nMonster HP: ${progress.currentMonster.health}`,
              inline: false
            });
          }
          
          embed.addFields({
            name: '🎮 Available Actions',
            value: '• `$explore` - Continue exploration\n• `$flee` - Flee from dungeon\n• `$dungeon map` - View floor map',
            inline: false
          });
          
          await message.reply({ embeds: [embed] });
          return;
        }
        
        // No active session - show dungeon menu
        const embed = GameEmbedBuilder.createGameEmbed(
          '🏰 Dungeon Command Center',
          'Manage your dungeon adventures',
          0x7C3AED
        );
        
        embed.addFields(
          {
            name: '📋 Commands',
            value: '• `$dungeon list` - View all dungeons\n• `$dungeon info <name>` - Detailed dungeon info\n• `$dungeon stats` - Your dungeon statistics\n• `$explore <number>` - Enter a dungeon',
            inline: false
          },
          {
            name: '📊 Your Stats',
            value: `**Dungeons Completed:** 0\n**Floors Cleared:** 0\n**Bosses Defeated:** 0`,
            inline: true
          }
        );
        
        embed.addFields({
          name: '🧀 Plagg\'s Advice',
          value: `*"Dungeons are like aged cheese cellars - the deeper you go, the more valuable the treasure. And the more likely you are to die."*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      const subcommand = args[0].toLowerCase();
      
      if (subcommand === 'list') {
        // Show all available dungeons
        const embed = GameEmbedBuilder.createGameEmbed(
          '📜 Dungeon Registry',
          'All known dungeons in the realm',
          0x7C3AED
        );
        
        gameData.dungeons.forEach((dungeon, index) => {
          const difficulty = getDungeonDifficulty(dungeon.minLevel);
          embed.addFields({
            name: `${index + 1}. ${dungeon.name}`,
            value: `**Level:** ${dungeon.minLevel}+ | **Floors:** ${dungeon.maxFloors} | **Difficulty:** ${difficulty}\n${dungeon.description}`,
            inline: false
          });
        });
        
        embed.addFields({
          name: '💡 How to Enter',
          value: 'Use `$explore <number>` to enter a dungeon by its number',
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        
      } else if (subcommand === 'info') {
        if (!args[1]) {
          const embed = GameEmbedBuilder.createWarningEmbed(
            'Please specify a dungeon name! Example: `$dungeon info shadow`'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        const query = args.slice(1).join(' ').toLowerCase();
        const dungeon = gameData.dungeons.find(d => 
          d.name.toLowerCase().includes(query) ||
          d.id.toLowerCase().includes(query)
        );
        
        if (!dungeon) {
          const embed = GameEmbedBuilder.createErrorEmbed(
            'Dungeon not found! Use `$dungeon list` to see all dungeons.'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        const embed = GameEmbedBuilder.createGameEmbed(
          `🏰 ${dungeon.name}`,
          dungeon.description,
          0x7C3AED
        );
        
        embed.addFields(
          {
            name: '📊 Dungeon Stats',
            value: `**Min Level:** ${dungeon.minLevel}\n**Max Floors:** ${dungeon.maxFloors}\n**Difficulty:** ${getDungeonDifficulty(dungeon.minLevel)}`,
            inline: true
          },
          {
            name: '👹 Monster Types',
            value: dungeon.monsters.slice(0, 5).join(', ') + (dungeon.monsters.length > 5 ? '...' : ''),
            inline: true
          }
        );
        
        // Show potential rewards
        if (dungeon.rewards && dungeon.rewards.length > 0) {
          const rewardText = dungeon.rewards.slice(0, 3).map(reward => 
            `• ${reward.itemId} (Floor ${reward.floor}+)`
          ).join('\n');
          
          embed.addFields({
            name: '🎁 Potential Rewards',
            value: rewardText,
            inline: false
          });
        }
        
        if (dungeon.plaggComment) {
          embed.addFields({
            name: '🧀 Plagg\'s Review',
            value: `*"${dungeon.plaggComment}"*`,
            inline: false
          });
        }
        
        await message.reply({ embeds: [embed] });
        
      } else if (subcommand === 'stats') {
        // Show player's dungeon statistics
        const embed = GameEmbedBuilder.createGameEmbed(
          `📊 ${player.username}'s Dungeon Stats`,
          'Your dungeon exploration achievements',
          0x3B82F6
        );
        
        // In a real implementation, these would be tracked in the database
        embed.addFields(
          {
            name: '🏆 Achievements',
            value: `**Dungeons Completed:** 0\n**Total Floors Cleared:** 0\n**Bosses Defeated:** 0\n**Treasures Found:** 0`,
            inline: true
          },
          {
            name: '⚔️ Combat Stats',
            value: `**Monsters Defeated:** 0\n**Total Damage Dealt:** 0\n**Damage Taken:** 0\n**Critical Hits:** 0`,
            inline: true
          }
        );
        
        embed.addFields({
          name: '💰 Rewards Earned',
          value: `**Gold from Dungeons:** 0 🪙\n**XP from Dungeons:** 0\n**Items Found:** 0`,
          inline: false
        });
        
        embed.addFields({
          name: '🧀 Plagg\'s Assessment',
          value: `*"Your dungeon record is as empty as my cheese stash after a midnight snack. Time to get exploring!"*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        
      } else if (subcommand === 'map') {
        // Show dungeon map if in active session
        const session = await dungeonRunner.getDungeonSession(player.discordId);
        
        if (!session) {
          const embed = GameEmbedBuilder.createWarningEmbed(
            'You are not currently in a dungeon. Enter one with `$explore <number>`'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        const dungeon = gameData.dungeons.find(d => d.id === session.dungeonId);
        const progress = JSON.parse(session.progress);
        
        if (!dungeon) {
          const errorEmbed = GameEmbedBuilder.createErrorEmbed(
            'Dungeon data not found.'
          );
          await message.reply({ embeds: [errorEmbed] });
          return;
        }
        
        const embed = GameEmbedBuilder.createGameEmbed(
          `🗺️ ${dungeon.name} - Floor ${progress.currentFloor}`,
          'Your current position in the dungeon',
          0x6B7280
        );
        
        // Create a simple visual map
        const mapSize = 5;
        let mapDisplay = '';
        
        for (let i = 0; i < mapSize; i++) {
          for (let j = 0; j < mapSize; j++) {
            if (i === 2 && j === progress.roomsCleared % mapSize) {
              mapDisplay += '👤'; // Player position
            } else if (j < progress.roomsCleared) {
              mapDisplay += '✅'; // Cleared rooms
            } else if (j === progress.roomsCleared) {
              mapDisplay += '🚪'; // Current room
            } else {
              mapDisplay += '❓'; // Unknown rooms
            }
          }
          mapDisplay += '\n';
        }
        
        embed.addFields({
          name: '🗺️ Floor Layout',
          value: `\`\`\`\n${mapDisplay}\`\`\`\n👤 You | ✅ Cleared | 🚪 Current | ❓ Unknown`,
          inline: false
        });
        
        embed.addFields({
          name: '📍 Current Progress',
          value: `**Floor:** ${progress.currentFloor}/${dungeon.maxFloors}\n**Rooms:** ${progress.roomsCleared}/${progress.totalRooms}`,
          inline: true
        });
        
        await message.reply({ embeds: [embed] });
        
      } else {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'Invalid dungeon command! Use:\n• `$dungeon` - View status\n• `$dungeon list` - All dungeons\n• `$dungeon info <name>` - Dungeon details\n• `$dungeon stats` - Your statistics'
        );
        await message.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to process dungeon command'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

function getDungeonDifficulty(minLevel: number): string {
  if (minLevel <= 5) return '⭐ Beginner';
  if (minLevel <= 15) return '⭐⭐ Intermediate';
  if (minLevel <= 25) return '⭐⭐⭐ Advanced';
  if (minLevel <= 35) return '⭐⭐⭐⭐ Expert';
  return '⭐⭐⭐⭐⭐ Master';
}

export default dungeon;
