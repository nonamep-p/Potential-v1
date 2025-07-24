import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { CombatManager } from '../../structures/CombatManager.js';
import { prisma } from '../../index.js';

const defend: Command = {
  name: 'defend',
  description: 'Defend during combat to reduce incoming damage by 50%',
  category: 'combat',
  cooldown: 2,
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      const combatManager = new CombatManager(prisma);
      
      // Check if player is in active combat
      const dungeonSession = await prisma.dungeonSession.findFirst({
        where: {
          playerId: player.discordId,
          isActive: true
        }
      });
      
      if (!dungeonSession) {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'No active combat found. Enter a dungeon with `$explore` to engage in combat.'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      const progress = JSON.parse(dungeonSession.progress);
      if (!progress.currentMonster) {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'No monster to defend against. Use `$explore` to find enemies.'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Execute defend action
      const result = await combatManager.processCombatTurn(
        player.discordId,
        { type: 'defend' },
        progress.currentMonster
      );
      
      const embed = GameEmbedBuilder.createCombatEmbed(
        player,
        progress.currentMonster,
        result.playerHealth,
        result.monsterHealth
      );
      
      embed.addFields({
        name: '🛡️ Defense Results',
        value: `${result.playerResult.message}\n${result.monsterResult.message}`,
        inline: false
      });
      
      // Update player health
      await DatabaseHelpers.updatePlayerStats(player.discordId, {
        health: result.playerHealth
      });
      
      // Update monster health in session
      progress.currentMonster.health = result.monsterHealth;
      await prisma.dungeonSession.update({
        where: { id: dungeonSession.id },
        data: { progress: JSON.stringify(progress) }
      });
      
      // Check if player was defeated
      if (result.playerHealth <= 0) {
        embed.addFields({
          name: '💀 Defeat!',
          value: 'Despite your defense, you have been defeated! You flee from the dungeon.',
          inline: false
        });
        
        // End dungeon session
        await prisma.dungeonSession.update({
          where: { id: dungeonSession.id },
          data: { isActive: false }
        });
        
        // Reset player health to 1
        await DatabaseHelpers.updatePlayerStats(player.discordId, {
          health: 1
        });
      }
      
      embed.addFields({
        name: '🧀 Plagg\'s Tactical Wisdom',
        value: `*"Defense is like aged cheese - sometimes you need time to let it work. But offense? That's like fresh mozzarella - immediate satisfaction!"*`,
        inline: false
      });
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to execute defense'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

export default defend;
