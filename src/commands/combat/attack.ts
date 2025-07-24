import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { CombatManager } from '../../structures/CombatManager.js';
import { loadGameData } from '../../utils/gameUtils.js';
import { prisma } from '../../index.js';

const attack: Command = {
  name: 'attack',
  description: 'Attack a monster during combat or start a training fight',
  category: 'combat',
  cooldown: 3,
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      const combatManager = new CombatManager(prisma);
      
      // Check if player is in an active dungeon session with combat
      const dungeonSession = await prisma.dungeonSession.findFirst({
        where: {
          playerId: player.discordId,
          isActive: true
        }
      });
      
      if (dungeonSession) {
        const progress = JSON.parse(dungeonSession.progress);
        if (progress.currentMonster) {
          // Continue dungeon combat
          const result = await combatManager.processCombatTurn(
            player.discordId,
            { type: 'attack' },
            progress.currentMonster
          );
          
          const embed = GameEmbedBuilder.createCombatEmbed(
            player,
            progress.currentMonster,
            result.playerHealth,
            result.monsterHealth
          );
          
          embed.addFields({
            name: '⚔️ Combat Results',
            value: `${result.playerResult.message}\n${result.monsterResult.message}`,
            inline: false
          });
          
          // Check if combat ended
          if (result.monsterHealth <= 0) {
            embed.addFields({
              name: '🎉 Victory!',
              value: `You defeated the ${progress.currentMonster.name}!\nGained ${progress.currentMonster.xpReward} XP and ${progress.currentMonster.goldReward} 🪙`,
              inline: false
            });
            
            // Remove monster from progress and award rewards
            delete progress.currentMonster;
            await prisma.dungeonSession.update({
              where: { id: dungeonSession.id },
              data: { progress: JSON.stringify(progress) }
            });
            
            await DatabaseHelpers.addXP(player.discordId, progress.currentMonster.xpReward);
            await DatabaseHelpers.addGold(player.discordId, progress.currentMonster.goldReward);
            
          } else if (result.playerHealth <= 0) {
            embed.addFields({
              name: '💀 Defeat!',
              value: 'You have been defeated! You flee from the dungeon.',
              inline: false
            });
            
            // End dungeon session
            await prisma.dungeonSession.update({
              where: { id: dungeonSession.id },
              data: { isActive: false }
            });
          }
          
          await message.reply({ embeds: [embed] });
          return;
        }
      }
      
      // Training combat
      if (args.length > 0) {
        const gameData = await loadGameData();
        const monsterName = args.join(' ').toLowerCase();
        const monster = gameData.monsters.find(m => 
          m.name.toLowerCase().includes(monsterName)
        );
        
        if (!monster) {
          const errorEmbed = GameEmbedBuilder.createErrorEmbed(
            'Monster not found! Use `$hunt` to find monsters to fight.'
          );
          await message.reply({ embeds: [errorEmbed] });
          return;
        }
        
        // Start training combat (simplified)
        const result = await combatManager.calculateDamage(
          await combatManager.getPlayerCombatStats(player),
          monster
        );
        
        const embed = GameEmbedBuilder.createGameEmbed(
          '🏋️ Training Combat',
          `You attack the training dummy styled after ${monster.name}`,
          0xDC2626
        );
        
        embed.addFields({
          name: '⚔️ Attack Result',
          value: result.message,
          inline: false
        });
        
        embed.addFields({
          name: '🧀 Plagg\'s Commentary',
          value: `*"Not bad, but you'd do more damage with a chunk of aged cheddar!"*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // No active combat
      const embed = GameEmbedBuilder.createWarningEmbed(
        'No active combat found. Enter a dungeon with `$explore` or start training with `$attack <monster>`'
      );
      
      embed.addFields({
        name: '💡 Combat Commands',
        value: '• `$explore` - Enter a dungeon for real combat\n• `$attack <monster>` - Training combat\n• `$duel @user` - Challenge another player',
        inline: false
      });
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to execute attack'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

export default attack;
