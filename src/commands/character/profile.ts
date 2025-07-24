import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';

const profile: Command = {
  name: 'profile',
  description: 'View your character profile with stats, equipment and progress',
  category: 'character',
  
  async execute(message: Message, args: string[]) {
    try {
      // Get target user (self if no mention, mentioned user otherwise)
      const targetUser = message.mentions.users.first() || message.author;
      
      // Get player data
      const player = await DatabaseHelpers.getPlayer(targetUser.id);
      const equipment = await DatabaseHelpers.getPlayerEquipment(targetUser.id);
      
      // Create profile embed
      const embed = GameEmbedBuilder.createProfileEmbed(player, equipment);
      
      // Add additional profile information
      const completedScenarios = JSON.parse(player.completedScenariosJson);
      const achievements = JSON.parse(player.achievements || '[]');
      
      embed.addFields(
        {
          name: '🎯 Progress',
          value: `**Scenarios:** ${completedScenarios.length}\n**Achievements:** ${achievements.length}\n**Daily Streak:** ${player.dailyStreak}`,
          inline: true
        }
      );
      
      // Add creation date
      const accountAge = Math.floor((Date.now() - player.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      embed.addFields({
        name: '📅 Account Info',
        value: `**Created:** ${accountAge} days ago\n**Last Updated:** <t:${Math.floor(player.updatedAt.getTime() / 1000)}:R>`,
        inline: true
      });
      
      // Add Plagg's opinion
      const plaggComments = [
        "Another cheese-less adventure, I see...",
        "Not bad, but have you tried adding more cheese to your build?",
        "Your stats are decent, but your cheese game is weak.",
        "Hmm, needs more chaos and definitely more camembert.",
        "I've seen worse... but I've also seen better cheese platters.",
      ];
      
      embed.addFields({
        name: '🧀 Plagg\'s Verdict',
        value: `*"${plaggComments[Math.floor(Math.random() * plaggComments.length)]}"*`,
        inline: false
      });
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to load profile'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

export default profile;
