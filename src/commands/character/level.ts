import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { calculateXPForLevel } from '../../utils/gameUtils.js';

const level: Command = {
  name: 'level',
  description: 'View detailed level information and progression',
  category: 'character',
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      
      // Calculate XP information
      const currentXP = player.xp;
      const currentLevel = player.level;
      const xpForCurrentLevel = calculateXPForLevel(currentLevel);
      const xpForNextLevel = calculateXPForLevel(currentLevel + 1);
      const xpProgress = currentXP - xpForCurrentLevel;
      const xpNeeded = xpForNextLevel - currentXP;
      const progressPercentage = Math.floor((xpProgress / (xpForNextLevel - xpForCurrentLevel)) * 100);
      
      // Create level embed
      const embed = GameEmbedBuilder.createGameEmbed(
        `📈 ${player.username}'s Level Info`,
        null,
        0x3B82F6
      );
      
      // Progress bar
      const progressBar = createProgressBar(progressPercentage);
      
      embed.addFields(
        {
          name: '📊 Current Progress',
          value: `**Level:** ${currentLevel}\n**XP:** ${currentXP.toLocaleString()}\n**Progress:** ${progressBar} ${progressPercentage}%`,
          inline: false
        },
        {
          name: '🎯 Next Level',
          value: `**XP Needed:** ${xpNeeded.toLocaleString()}\n**Total for Level ${currentLevel + 1}:** ${xpForNextLevel.toLocaleString()}`,
          inline: true
        }
      );
      
      // Calculate stat gains on next level up
      const statGains = {
        strength: 2,
        intelligence: 2,
        defense: 1,
        agility: 1,
        luck: 1,
        maxHealth: 5,
        maxMana: 3
      };
      
      embed.addFields({
        name: '📈 Next Level Rewards',
        value: `**STR:** +${statGains.strength} | **INT:** +${statGains.intelligence}\n**DEF:** +${statGains.defense} | **AGI:** +${statGains.agility}\n**LCK:** +${statGains.luck}\n**Max HP:** +${statGains.maxHealth} | **Max MP:** +${statGains.maxMana}`,
        inline: true
      });
      
      // Add level milestones
      const milestones = [
        { level: 10, reward: 'Unlock Advanced Classes' },
        { level: 25, reward: 'Unlock Faction Quests' },
        { level: 50, reward: 'Unlock Legendary Dungeons' },
        { level: 100, reward: 'Unlock Mythic Equipment' },
      ];
      
      const nextMilestone = milestones.find(m => m.level > currentLevel);
      if (nextMilestone) {
        embed.addFields({
          name: '🏆 Next Milestone',
          value: `**Level ${nextMilestone.level}:** ${nextMilestone.reward}`,
          inline: false
        });
      }
      
      // Plagg's motivation
      const motivationalComments = [
        "Level up faster! I'm getting bored watching your progress.",
        "More levels means more cheese-worthy adventures!",
        "At this rate, you'll be ready for real chaos by next century.",
        "Keep grinding, mortal. The cheese gods demand strength!",
        "Your level is acceptable, but your cheese consumption is lacking.",
      ];
      
      embed.addFields({
        name: '🧀 Plagg\'s Motivation',
        value: `*"${motivationalComments[Math.floor(Math.random() * motivationalComments.length)]}"*`,
        inline: false
      });
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to load level information'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

// Helper function to create progress bar
function createProgressBar(percentage: number, length: number = 20): string {
  const filled = Math.floor((percentage / 100) * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

export default level;
