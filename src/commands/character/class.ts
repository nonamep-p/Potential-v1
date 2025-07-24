import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { loadGameData } from '../../utils/gameUtils.js';

const classCommand: Command = {
  name: 'class',
  description: 'View available classes or change your character class',
  category: 'character',
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      const gameData = await loadGameData();
      
      if (args.length === 0) {
        // Show current class and available classes
        const embed = GameEmbedBuilder.createGameEmbed(
          '🎭 Character Classes',
          'Choose your path of power and chaos!',
          0x8B5CF6
        );
        
        embed.addFields({
          name: '🎯 Your Current Class',
          value: `**${player.className}**`,
          inline: false
        });
        
        // Show available classes
        const classInfo = gameData.classes.map(cls => 
          `**${cls.name}** - ${cls.description}\n*Bonuses: STR +${cls.statBonus.strength}, INT +${cls.statBonus.intelligence}, DEF +${cls.statBonus.defense}*`
        ).join('\n\n');
        
        embed.addFields({
          name: '📚 Available Classes',
          value: classInfo,
          inline: false
        });
        
        embed.addFields({
          name: '💡 How to Change',
          value: `Use \`$class <classname>\` to change your class\nNote: Class changes cost 1000 🪙 and reset your equipment`,
          inline: false
        });
        
        embed.addFields({
          name: '🧀 Plagg\'s Advice',
          value: `*"Pick whatever class sounds most chaotic. They're all equally cheese-deprived anyway."*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Class change logic
      const newClassId = args[0].toLowerCase();
      const newClass = gameData.classes.find(c => 
        c.id.toLowerCase() === newClassId || 
        c.name.toLowerCase() === newClassId
      );
      
      if (!newClass) {
        const errorEmbed = GameEmbedBuilder.createErrorEmbed(
          'Class not found! Use `$class` to see available classes.'
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      if (player.className === newClass.name) {
        const warningEmbed = GameEmbedBuilder.createWarningEmbed(
          'You are already that class!'
        );
        await message.reply({ embeds: [warningEmbed] });
        return;
      }
      
      // Check cost and level requirement
      const cost = 1000;
      const minLevel = 10;
      
      if (player.level < minLevel) {
        const errorEmbed = GameEmbedBuilder.createErrorEmbed(
          `You need to be level ${minLevel} or higher to change classes!`
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      if (player.gold < cost) {
        const errorEmbed = GameEmbedBuilder.createErrorEmbed(
          `Class change costs ${cost} 🪙. You only have ${player.gold} 🪙.`
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Update player class and reset equipment
      await DatabaseHelpers.updatePlayerStats(player.discordId, {
        className: newClass.name,
        gold: { decrement: cost },
        equipmentJson: JSON.stringify({}), // Reset equipment
        // Apply new class bonuses
        strength: 10 + newClass.statBonus.strength + (player.level - 1) * 2,
        intelligence: 10 + newClass.statBonus.intelligence + (player.level - 1) * 2,
        defense: 10 + newClass.statBonus.defense + (player.level - 1) * 1,
        agility: 10 + newClass.statBonus.agility + (player.level - 1) * 1,
        luck: 10 + newClass.statBonus.luck + (player.level - 1) * 1,
      });
      
      const successEmbed = GameEmbedBuilder.createSuccessEmbed(
        `Class changed to **${newClass.name}**! Your equipment has been unequipped due to the transformation.`
      );
      
      successEmbed.addFields({
        name: '📊 New Stat Bonuses',
        value: `**STR:** +${newClass.statBonus.strength}\n**INT:** +${newClass.statBonus.intelligence}\n**DEF:** +${newClass.statBonus.defense}\n**AGI:** +${newClass.statBonus.agility}\n**LCK:** +${newClass.statBonus.luck}`,
        inline: true
      });
      
      successEmbed.addFields({
        name: '🧀 Plagg\'s Commentary',
        value: `*"${newClass.plaggComment}"*`,
        inline: false
      });
      
      await message.reply({ embeds: [successEmbed] });
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to process class command'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

export default classCommand;
