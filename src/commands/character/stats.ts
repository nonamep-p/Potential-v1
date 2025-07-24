import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { loadGameData } from '../../utils/gameUtils.js';

const stats: Command = {
  name: 'stats',
  description: 'View detailed character statistics and combat effectiveness',
  category: 'character',
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      const equipment = await DatabaseHelpers.getPlayerEquipment(player.discordId);
      const gameData = await loadGameData();
      
      // Calculate total stats with equipment bonuses
      const totalStats = await calculateTotalStats(player, equipment, gameData);
      
      // Create stats embed
      const embed = GameEmbedBuilder.createGameEmbed(
        `⚔️ ${player.username}'s Combat Stats`,
        'Detailed breakdown of your character\'s combat effectiveness',
        0xDC2626
      );
      
      // Base stats
      embed.addFields(
        {
          name: '📊 Base Attributes',
          value: `**Strength:** ${player.strength} → ${totalStats.strength}\n**Intelligence:** ${player.intelligence} → ${totalStats.intelligence}\n**Defense:** ${player.defense} → ${totalStats.defense}\n**Agility:** ${player.agility} → ${totalStats.agility}\n**Luck:** ${player.luck} → ${totalStats.luck}`,
          inline: true
        },
        {
          name: '❤️ Health & Mana',
          value: `**Health:** ${player.health}/${totalStats.maxHealth}\n**Mana:** ${player.mana}/${totalStats.maxMana}\n**Health Regen:** ${Math.floor(totalStats.maxHealth * 0.05)}/5min\n**Mana Regen:** ${Math.floor(totalStats.maxMana * 0.1)}/5min`,
          inline: true
        }
      );
      
      // Combat calculations
      const physicalDamage = Math.floor((totalStats.strength * 0.5) + (totalStats.weaponAttack || 0));
      const magicalDamage = Math.floor((totalStats.intelligence * 0.5) + (totalStats.staffAttack || 0));
      const critRate = totalStats.critRate || 5;
      const critDamage = totalStats.critDamage || 150;
      
      embed.addFields({
        name: '⚔️ Combat Effectiveness',
        value: `**Physical Damage:** ${physicalDamage}\n**Magical Damage:** ${magicalDamage}\n**Critical Rate:** ${critRate}%\n**Critical Damage:** ${critDamage}%\n**Defense Rating:** ${totalStats.defense}`,
        inline: true
      });
      
      // Equipment bonuses summary
      const equipmentBonuses = calculateEquipmentBonuses(player, equipment, gameData);
      if (Object.keys(equipmentBonuses).length > 0) {
        const bonusText = Object.entries(equipmentBonuses)
          .map(([stat, bonus]) => `**${stat}:** +${bonus}`)
          .join('\n');
          
        embed.addFields({
          name: '🛡️ Equipment Bonuses',
          value: bonusText || 'No equipment bonuses',
          inline: true
        });
      }
      
      // Combat ratings
      const combatPower = Math.floor(
        (totalStats.strength + totalStats.intelligence + totalStats.defense) * 
        (totalStats.level * 0.1 + 1)
      );
      
      const survivalRating = Math.floor(
        (totalStats.maxHealth + totalStats.defense * 10) / 10
      );
      
      embed.addFields({
        name: '🏆 Combat Ratings',
        value: `**Combat Power:** ${combatPower}\n**Survival Rating:** ${survivalRating}\n**ELO Rating:** ${player.elo}`,
        inline: true
      });
      
      // Stat comparison with level average
      const levelAverageStats = calculateLevelAverageStats(player.level);
      const comparison = compareStatsToAverage(totalStats, levelAverageStats);
      
      embed.addFields({
        name: '📈 Level Comparison',
        value: comparison,
        inline: false
      });
      
      // Plagg's analysis
      const analysisComments = [
        "Your stats are as bland as unseasoned cheese.",
        "Not terrible, but I've seen more impressive cheese wheels.",
        "Decent power, but where's the chaos factor?",
        "Your combat prowess is adequate for a mere mortal.",
        "These numbers bore me. Show me your cheese collection instead!",
      ];
      
      embed.addFields({
        name: '🧀 Plagg\'s Analysis',
        value: `*"${analysisComments[Math.floor(Math.random() * analysisComments.length)]}"*`,
        inline: false
      });
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to load character stats'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

// Calculate total stats including equipment
async function calculateTotalStats(player: any, equipment: any, gameData: any) {
  let totalStats = {
    strength: player.strength,
    intelligence: player.intelligence,
    defense: player.defense,
    agility: player.agility,
    luck: player.luck,
    maxHealth: player.maxHealth,
    maxMana: player.maxMana,
    level: player.level,
    weaponAttack: 0,
    staffAttack: 0,
    critRate: 5,
    critDamage: 150,
  };
  
  // Apply equipment bonuses
  const allItems = [
    ...gameData.weapons,
    ...gameData.armor,
    ...gameData.accessories
  ];
  
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (itemId) {
      const item = allItems.find((i: any) => i.id === itemId);
      if (item) {
        if (item.type === 'weapon') {
          if (item.weaponType === 'staff') {
            totalStats.staffAttack += item.attack || 0;
          } else {
            totalStats.weaponAttack += item.attack || 0;
          }
          totalStats.critRate = item.critRate || totalStats.critRate;
          totalStats.critDamage = item.critDamage || totalStats.critDamage;
        } else if (item.type === 'armor') {
          totalStats.defense += item.defense || 0;
          totalStats.maxHealth += item.healthBonus || 0;
          totalStats.maxMana += item.manaBonus || 0;
        } else if (item.type === 'accessory' && item.statBonus) {
          for (const [stat, bonus] of Object.entries(item.statBonus)) {
            if (stat in totalStats) {
              (totalStats as any)[stat] += bonus;
            }
          }
        }
      }
    }
  }
  
  return totalStats;
}

// Calculate equipment bonuses
function calculateEquipmentBonuses(player: any, equipment: any, gameData: any) {
  const bonuses: any = {};
  const allItems = [...gameData.weapons, ...gameData.armor, ...gameData.accessories];
  
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (itemId) {
      const item = allItems.find((i: any) => i.id === itemId);
      if (item) {
        if (item.type === 'weapon' && item.attack) {
          bonuses['Attack'] = (bonuses['Attack'] || 0) + item.attack;
        } else if (item.type === 'armor') {
          if (item.defense) bonuses['Defense'] = (bonuses['Defense'] || 0) + item.defense;
          if (item.healthBonus) bonuses['Max Health'] = (bonuses['Max Health'] || 0) + item.healthBonus;
          if (item.manaBonus) bonuses['Max Mana'] = (bonuses['Max Mana'] || 0) + item.manaBonus;
        } else if (item.type === 'accessory' && item.statBonus) {
          for (const [stat, bonus] of Object.entries(item.statBonus)) {
            const displayStat = stat.charAt(0).toUpperCase() + stat.slice(1);
            bonuses[displayStat] = (bonuses[displayStat] || 0) + (bonus as number);
          }
        }
      }
    }
  }
  
  return bonuses;
}

// Calculate average stats for a level
function calculateLevelAverageStats(level: number) {
  const baseStats = 10;
  const statGrowth = 2; // per level
  
  return {
    strength: baseStats + (level - 1) * statGrowth,
    intelligence: baseStats + (level - 1) * statGrowth,
    defense: baseStats + (level - 1) * 1,
    agility: baseStats + (level - 1) * 1,
    luck: baseStats + (level - 1) * 1,
    maxHealth: 100 + (level - 1) * 5,
    maxMana: 50 + (level - 1) * 3,
  };
}

// Compare stats to level average
function compareStatsToAverage(playerStats: any, averageStats: any): string {
  const comparisons = [];
  
  const statsToCompare = ['strength', 'intelligence', 'defense', 'agility', 'luck'];
  
  for (const stat of statsToCompare) {
    const playerValue = playerStats[stat];
    const averageValue = averageStats[stat];
    const difference = playerValue - averageValue;
    const percentage = Math.round((difference / averageValue) * 100);
    
    let indicator = '=';
    if (percentage > 10) indicator = '↗️';
    else if (percentage < -10) indicator = '↘️';
    
    comparisons.push(`**${stat.toUpperCase()}:** ${indicator} ${percentage > 0 ? '+' : ''}${percentage}%`);
  }
  
  return comparisons.join('\n');
}

export default stats;
