import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { loadGameData } from '../../utils/gameUtils.js';

const skills: Command = {
  name: 'skills',
  description: 'View and use your class skills in combat',
  category: 'combat',
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      const gameData = await loadGameData();
      
      // Find player's class
      const playerClass = gameData.classes.find(c => c.name === player.className);
      if (!playerClass) {
        const errorEmbed = GameEmbedBuilder.createErrorEmbed(
          'Your class data could not be found. Contact an administrator.'
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      if (args.length === 0) {
        // Show available skills
        const embed = GameEmbedBuilder.createGameEmbed(
          `⚡ ${player.className} Skills`,
          `Available skills for ${player.username}`,
          0x7C3AED
        );
        
        if (playerClass.skills.length === 0) {
          embed.setDescription('Your class has no special skills yet. Skills unlock at higher levels!');
        } else {
          const skillList = playerClass.skills.map((skill, index) => 
            `**${index + 1}. ${skill.name}** (${skill.cost} MP)\n${skill.description}\n*Cooldown: ${skill.cooldown || 0} turns*`
          ).join('\n\n');
          
          embed.addFields({
            name: '📚 Your Skills',
            value: skillList,
            inline: false
          });
          
          embed.addFields({
            name: '💡 Usage',
            value: `Use \`$skills use <skill name>\` to cast a skill in combat\nCurrent MP: ${player.mana}/${player.maxMana}`,
            inline: false
          });
        }
        
        embed.addFields({
          name: '🧀 Plagg\'s Skill Review',
          value: `*"${playerClass.plaggComment}"*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Skill usage
      if (args[0].toLowerCase() === 'use' && args.length > 1) {
        const skillName = args.slice(1).join(' ').toLowerCase();
        const skill = playerClass.skills.find(s => s.name.toLowerCase() === skillName);
        
        if (!skill) {
          const errorEmbed = GameEmbedBuilder.createErrorEmbed(
            'Skill not found! Use `$skills` to see your available skills.'
          );
          await message.reply({ embeds: [errorEmbed] });
          return;
        }
        
        // Check mana cost
        if (player.mana < skill.cost) {
          const errorEmbed = GameEmbedBuilder.createErrorEmbed(
            `Not enough mana! You need ${skill.cost} MP but only have ${player.mana} MP.`
          );
          await message.reply({ embeds: [errorEmbed] });
          return;
        }
        
        // Check if in combat
        const dungeonSession = await DatabaseHelpers.prisma.dungeonSession.findFirst({
          where: {
            playerId: player.discordId,
            isActive: true
          }
        });
        
        if (!dungeonSession) {
          const errorEmbed = GameEmbedBuilder.createWarningEmbed(
            'Skills can only be used in combat! Enter a dungeon with `$explore` first.'
          );
          await message.reply({ embeds: [errorEmbed] });
          return;
        }
        
        const progress = JSON.parse(dungeonSession.progress);
        if (!progress.currentMonster) {
          const errorEmbed = GameEmbedBuilder.createWarningEmbed(
            'No monster to use skills against!'
          );
          await message.reply({ embeds: [errorEmbed] });
          return;
        }
        
        // Use skill (simplified implementation)
        await DatabaseHelpers.updatePlayerStats(player.discordId, {
          mana: { decrement: skill.cost }
        });
        
        // Calculate skill effect based on skill type
        let damage = 0;
        let healing = 0;
        let effect = '';
        
        // Simple skill effects based on name patterns
        if (skill.name.toLowerCase().includes('heal')) {
          healing = Math.floor(player.intelligence * 0.8 + 20);
          effect = `Restored ${healing} HP`;
          await DatabaseHelpers.updatePlayerStats(player.discordId, {
            health: Math.min(player.health + healing, player.maxHealth)
          });
        } else if (skill.name.toLowerCase().includes('fire') || skill.name.toLowerCase().includes('lightning')) {
          damage = Math.floor(player.intelligence * 1.2 + 15);
          effect = `Dealt ${damage} magical damage`;
          progress.currentMonster.health -= damage;
        } else {
          damage = Math.floor((player.strength + player.intelligence) * 0.7 + 10);
          effect = `Dealt ${damage} skill damage`;
          progress.currentMonster.health -= damage;
        }
        
        // Update monster health
        await DatabaseHelpers.prisma.dungeonSession.update({
          where: { id: dungeonSession.id },
          data: { progress: JSON.stringify(progress) }
        });
        
        const embed = GameEmbedBuilder.createGameEmbed(
          `⚡ ${skill.name}`,
          `${player.username} uses ${skill.name}!`,
          0x7C3AED
        );
        
        embed.addFields(
          {
            name: '🎯 Skill Effect',
            value: effect,
            inline: true
          },
          {
            name: '💙 Mana Cost',
            value: `${skill.cost} MP (${player.mana - skill.cost}/${player.maxMana} remaining)`,
            inline: true
          }
        );
        
        // Check if monster was defeated
        if (progress.currentMonster.health <= 0) {
          embed.addFields({
            name: '🎉 Victory!',
            value: `Your skill finished off the ${progress.currentMonster.name}!\nGained ${progress.currentMonster.xpReward} XP and ${progress.currentMonster.goldReward} 🪙`,
            inline: false
          });
          
          // Award rewards
          await DatabaseHelpers.addXP(player.discordId, progress.currentMonster.xpReward);
          await DatabaseHelpers.addGold(player.discordId, progress.currentMonster.goldReward);
          
          // Remove monster
          delete progress.currentMonster;
          await DatabaseHelpers.prisma.dungeonSession.update({
            where: { id: dungeonSession.id },
            data: { progress: JSON.stringify(progress) }
          });
        }
        
        embed.addFields({
          name: '🧀 Plagg\'s Skill Analysis',
          value: `*"Fancy magic is nice, but have you tried throwing cheese? It's surprisingly effective!"*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Invalid usage
      const embed = GameEmbedBuilder.createWarningEmbed(
        'Invalid usage! Use `$skills` to view skills or `$skills use <skillname>` to cast.'
      );
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to process skills command'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

export default skills;
