import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { DungeonRunner } from '../../structures/DungeonRunner.js';
import { loadGameData } from '../../utils/gameUtils.js';
import { prisma } from '../../index.js';

const explore: Command = {
  name: 'explore',
  description: 'Explore dungeons and encounter monsters, treasures, and events',
  category: 'dungeon',
  cooldown: 5,
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      const dungeonRunner = new DungeonRunner(prisma);
      const gameData = await loadGameData();
      
      // Check if player is already in a dungeon
      const existingSession = await dungeonRunner.getDungeonSession(player.discordId);
      
      if (existingSession) {
        // Continue exploration in current dungeon
        const dungeon = gameData.dungeons.find(d => d.id === existingSession.dungeonId);
        const progress = JSON.parse(existingSession.progress);
        
        if (!dungeon) {
          const errorEmbed = GameEmbedBuilder.createErrorEmbed(
            'Dungeon data not found. Your session has been reset.'
          );
          await prisma.dungeonSession.update({
            where: { id: existingSession.id },
            data: { isActive: false }
          });
          await message.reply({ embeds: [errorEmbed] });
          return;
        }
        
        // Check if player is in combat
        if (progress.currentMonster) {
          const embed = GameEmbedBuilder.createCombatEmbed(
            player,
            progress.currentMonster,
            progress.playerHealth,
            progress.currentMonster.health
          );
          
          embed.addFields({
            name: '⚔️ Combat In Progress',
            value: 'Use combat commands:\n• `$attack` - Attack the monster\n• `$defend` - Reduce incoming damage\n• `$skills use <skill>` - Use a skill',
            inline: false
          });
          
          await message.reply({ embeds: [embed] });
          return;
        }
        
        // Progress to next room
        const result = await dungeonRunner.progressRoom(player.discordId);
        
        const embed = GameEmbedBuilder.createDungeonEmbed(
          dungeon,
          result.progress.currentFloor,
          result.progress.roomsCleared,
          result.progress.totalRooms
        );
        
        embed.setTitle(`🏰 ${dungeon.name} - Floor ${result.progress.currentFloor}`);
        embed.setDescription(result.message);
        
        // Handle different encounter types
        if (result.encounter.type === 'monster') {
          const monster = result.encounter.data;
          embed.addFields({
            name: '👹 Monster Encounter',
            value: `**${monster.name}** (Level ${monster.level})\n${monster.description}\n\nHP: ${monster.health}/${monster.health}`,
            inline: false
          });
          
          embed.addFields({
            name: '⚔️ Combat Options',
            value: '• `$attack` - Attack the monster\n• `$defend` - Defensive stance\n• `$skills` - View your skills',
            inline: false
          });
          
          if (monster.plaggComment) {
            embed.addFields({
              name: '🧀 Plagg\'s Monster Review',
              value: `*"${monster.plaggComment}"*`,
              inline: false
            });
          }
          
        } else if (result.encounter.type === 'treasure') {
          const treasure = result.encounter.data;
          embed.addFields({
            name: '💰 Treasure Found!',
            value: `You discovered a treasure chest!\n${result.message}`,
            inline: false
          });
          
        } else if (result.encounter.type === 'event') {
          const event = result.encounter.data;
          embed.addFields({
            name: '✨ Special Event',
            value: `**${event.name}**\n${event.description}`,
            inline: false
          });
          
          if (event.choices) {
            const choices = event.choices.map((choice: any, index: number) => 
              `${index + 1}. ${choice.text}`
            ).join('\n');
            
            embed.addFields({
              name: '🤔 Choose Your Action',
              value: choices + '\n\nUse `$explore choice <number>` to decide',
              inline: false
            });
          }
        }
        
        // Check if dungeon completed
        if (result.completed) {
          embed.setTitle('🎉 Dungeon Completed!');
          embed.setColor(0x10B981);
          embed.addFields({
            name: '🏆 Congratulations!',
            value: 'You have successfully cleared the dungeon!\nReturning to the surface...',
            inline: false
          });
        }
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // No active session - show available dungeons
      if (args.length === 0) {
        const embed = GameEmbedBuilder.createGameEmbed(
          '🗺️ Available Dungeons',
          'Choose your adventure!',
          0x7C3AED
        );
        
        const dungeonList = gameData.dungeons.map((dungeon, index) => 
          `**${index + 1}. ${dungeon.name}**\n` +
          `Min Level: ${dungeon.minLevel} | Floors: ${dungeon.maxFloors}\n` +
          `${dungeon.description}`
        ).join('\n\n');
        
        embed.addFields({
          name: '🏰 Dungeons',
          value: dungeonList,
          inline: false
        });
        
        embed.addFields({
          name: '💡 How to Enter',
          value: 'Use `$explore <dungeon number>` to enter a dungeon\nExample: `$explore 1`',
          inline: false
        });
        
        embed.addFields({
          name: '🧀 Plagg\'s Dungeon Guide',
          value: `*"Dungeons are like cheese caves - dark, mysterious, and full of things that want to eat you. Perfect for adventure!"*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Handle choice selection for events
      if (args[0].toLowerCase() === 'choice') {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'No active event to make a choice for. Explore a dungeon first!'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Enter a specific dungeon
      const dungeonNumber = parseInt(args[0]);
      if (isNaN(dungeonNumber) || dungeonNumber < 1 || dungeonNumber > gameData.dungeons.length) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          'Invalid dungeon number! Use `$explore` to see available dungeons.'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      const selectedDungeon = gameData.dungeons[dungeonNumber - 1];
      
      // Check level requirement
      if (player.level < selectedDungeon.minLevel) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          `You need to be level ${selectedDungeon.minLevel} or higher to enter ${selectedDungeon.name}!`
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Check health requirement
      if (player.health < player.maxHealth * 0.5) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          'You need at least 50% health to enter a dungeon! Rest or use healing items first.'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Start new dungeon session
      await dungeonRunner.startDungeon(player.discordId, selectedDungeon.id);
      
      const embed = GameEmbedBuilder.createDungeonEmbed(selectedDungeon, 1, 0, 5);
      embed.setTitle(`🚪 Entering ${selectedDungeon.name}`);
      embed.setDescription('You step into the dungeon entrance. The air grows cold and mysterious...');
      
      embed.addFields({
        name: '🎯 Dungeon Info',
        value: `**Min Level:** ${selectedDungeon.minLevel}\n**Max Floors:** ${selectedDungeon.maxFloors}\n**Difficulty:** ${getDifficultyName(selectedDungeon.minLevel)}`,
        inline: true
      });
      
      embed.addFields({
        name: '💡 Tips',
        value: '• Use `$explore` to move forward\n• Combat will start automatically\n• You can flee with `$flee` if needed',
        inline: true
      });
      
      if (selectedDungeon.plaggComment) {
        embed.addFields({
          name: '🧀 Plagg\'s Warning',
          value: `*"${selectedDungeon.plaggComment}"*`,
          inline: false
        });
      }
      
      await message.reply({ embeds: [embed] });
      
      // Automatically progress to first room
      setTimeout(async () => {
        try {
          const result = await dungeonRunner.progressRoom(player.discordId);
          const followUpEmbed = GameEmbedBuilder.createGameEmbed(
            '👣 First Steps',
            result.message,
            0x7C3AED
          );
          
          if (result.encounter.type === 'monster') {
            followUpEmbed.addFields({
              name: '⚔️ First Encounter',
              value: `A ${result.encounter.data.name} blocks your path!`,
              inline: false
            });
          }
          
          await message.followUp({ embeds: [followUpEmbed] });
        } catch (error) {
          console.error('Error in auto-progress:', error);
        }
      }, 2000);
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to explore dungeon'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

function getDifficultyName(minLevel: number): string {
  if (minLevel <= 5) return 'Beginner';
  if (minLevel <= 15) return 'Intermediate';
  if (minLevel <= 25) return 'Advanced';
  if (minLevel <= 35) return 'Expert';
  return 'Master';
}

export default explore;
