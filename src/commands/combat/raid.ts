import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { loadGameData } from '../../utils/gameUtils.js';

const raid: Command = {
  name: 'raid',
  description: 'Join or start a raid against powerful boss monsters',
  category: 'combat',
  cooldown: 60,
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      
      if (args.length === 0) {
        // Show available raids
        const embed = GameEmbedBuilder.createGameEmbed(
          '🐉 Available Raids',
          'Team up with other players to defeat powerful bosses!',
          0x7C2D12
        );
        
        // Mock raid bosses - in a real implementation, these would be in the database
        const raids = [
          {
            name: 'Ancient Dragon Gruyere',
            level: 25,
            participants: '2/8',
            reward: '5000 🪙',
            status: 'Open'
          },
          {
            name: 'Cheese Golem Supreme',
            level: 15,
            participants: '1/6',
            reward: '2500 🪙',
            status: 'Open'
          },
          {
            name: 'Shadow Lord Camembert',
            level: 35,
            participants: '0/10',
            reward: '10000 🪙',
            status: 'Open'
          }
        ];
        
        const raidList = raids.map((raid, index) => 
          `**${index + 1}. ${raid.name}** (Level ${raid.level})\n` +
          `Participants: ${raid.participants} | Reward: ${raid.reward}\n` +
          `Status: ${raid.status}`
        ).join('\n\n');
        
        embed.addFields({
          name: '🏆 Current Raids',
          value: raidList,
          inline: false
        });
        
        embed.addFields({
          name: '💡 How to Join',
          value: '• `$raid join <number>` - Join a raid\n• `$raid create <boss>` - Start a new raid\n• `$raid status` - Check your current raid',
          inline: false
        });
        
        embed.addFields({
          name: '📋 Requirements',
          value: '• Minimum level varies by raid\n• Must have full health to participate\n• Raids start automatically when full',
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      const action = args[0].toLowerCase();
      
      if (action === 'join') {
        if (!args[1]) {
          const embed = GameEmbedBuilder.createWarningEmbed(
            'Please specify which raid to join! Example: `$raid join 1`'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        const raidNumber = parseInt(args[1]);
        if (isNaN(raidNumber) || raidNumber < 1 || raidNumber > 3) {
          const embed = GameEmbedBuilder.createErrorEmbed(
            'Invalid raid number! Use `$raid` to see available raids.'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        // Check requirements
        const minLevels = [25, 15, 35];
        const requiredLevel = minLevels[raidNumber - 1];
        
        if (player.level < requiredLevel) {
          const embed = GameEmbedBuilder.createErrorEmbed(
            `You need to be level ${requiredLevel} or higher to join this raid!`
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        if (player.health < player.maxHealth) {
          const embed = GameEmbedBuilder.createErrorEmbed(
            'You must have full health to join a raid! Rest or use healing items first.'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        // Join raid (simplified - would need proper raid system)
        const embed = GameEmbedBuilder.createSuccessEmbed(
          `You joined the raid! Waiting for other participants...`
        );
        
        embed.addFields({
          name: '⏰ Raid Status',
          value: 'You will be notified when the raid starts.\nRaids begin automatically when enough players join.',
          inline: false
        });
        
        embed.addFields({
          name: '🧀 Plagg\'s Raid Prep',
          value: `*"Good luck storming the castle! Bring cheese for sustenance. Trust me on this one."*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        
      } else if (action === 'create') {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'Custom raid creation is not available yet. Choose from existing raids with `$raid`'
        );
        await message.reply({ embeds: [embed] });
        
      } else if (action === 'status') {
        // Check if player is in a raid
        const embed = GameEmbedBuilder.createGameEmbed(
          '📊 Raid Status',
          'Your current raid participation status',
          0x7C2D12
        );
        
        embed.addFields({
          name: '🎯 Current Status',
          value: 'You are not currently in any raids.\nUse `$raid` to see available raids to join.',
          inline: false
        });
        
        embed.addFields({
          name: '📈 Raid Statistics',
          value: `**Raids Completed:** 0\n**Bosses Defeated:** 0\n**Total Raid Rewards:** 0 🪙`,
          inline: true
        });
        
        await message.reply({ embeds: [embed] });
        
      } else if (action === 'leave') {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'You are not currently in any raids to leave.'
        );
        await message.reply({ embeds: [embed] });
        
      } else {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'Invalid raid command! Use:\n• `$raid` - View raids\n• `$raid join <number>` - Join raid\n• `$raid status` - Check status'
        );
        await message.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to process raid command'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

export default raid;
