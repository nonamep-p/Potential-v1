import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { Player } from '@prisma/client';
import { RARITY_COLORS } from '../types.js';

export class GameEmbedBuilder {
  // Create a standard game embed with Plagg theme
  static createGameEmbed(title: string, description?: string, color?: ColorResolvable): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description || null)
      .setColor(color || 0x3B82F6) // Default blue
      .setTimestamp()
      .setFooter({ text: '🧀 Plagg RPG | Powered by cheese and chaos' });
  }
  
  // Create error embed
  static createErrorEmbed(message: string): EmbedBuilder {
    return this.createGameEmbed('❌ Error', message, 0xEF4444);
  }
  
  // Create success embed
  static createSuccessEmbed(message: string): EmbedBuilder {
    return this.createGameEmbed('✅ Success', message, 0x10B981);
  }
  
  // Create warning embed
  static createWarningEmbed(message: string): EmbedBuilder {
    return this.createGameEmbed('⚠️ Warning', message, 0xF59E0B);
  }
  
  // Create player profile embed
  static createProfileEmbed(player: Player, equipment?: any, stats?: any): EmbedBuilder {
    const embed = this.createGameEmbed(`${player.username}'s Profile`, null, 0x8B5CF6);
    
    // Basic info
    embed.addFields(
      {
        name: '📊 Basic Stats',
        value: `**Level:** ${player.level}\n**XP:** ${player.xp}/${Math.pow(player.level * 10, 2)}\n**Gold:** ${player.gold.toLocaleString()} 🪙`,
        inline: true
      },
      {
        name: '⚔️ Combat Stats',
        value: `**HP:** ${player.health}/${player.maxHealth}\n**MP:** ${player.mana}/${player.maxMana}\n**ELO:** ${player.elo}`,
        inline: true
      },
      {
        name: '📈 Attributes',
        value: `**STR:** ${player.strength} | **INT:** ${player.intelligence}\n**DEF:** ${player.defense} | **AGI:** ${player.agility}\n**LCK:** ${player.luck}`,
        inline: true
      }
    );
    
    // Class and faction
    if (player.className || player.factionId) {
      embed.addFields({
        name: '🎭 Identity',
        value: `**Class:** ${player.className}\n**Faction:** ${player.factionId || 'None'}`,
        inline: true
      });
    }
    
    // Equipment summary
    if (equipment) {
      const equippedItems = Object.entries(equipment).filter(([_, itemId]) => itemId).length;
      embed.addFields({
        name: '🛡️ Equipment',
        value: `${equippedItems}/9 slots equipped\nUse \`$inventory\` to manage gear`,
        inline: true
      });
    }
    
    return embed;
  }
  
  // Create item embed
  static createItemEmbed(item: any, quantity?: number): EmbedBuilder {
    const rarityColor = RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] || 0x9CA3AF;
    const embed = this.createGameEmbed(item.name, item.description, rarityColor);
    
    // Item stats
    embed.addFields({
      name: '📋 Item Info',
      value: `**Type:** ${item.type}\n**Rarity:** ${item.rarity}\n**Value:** ${item.value} 🪙${quantity ? `\n**Quantity:** ${quantity}` : ''}`,
      inline: true
    });
    
    // Type-specific stats
    if (item.type === 'weapon') {
      embed.addFields({
        name: '⚔️ Weapon Stats',
        value: `**Attack:** ${item.attack}\n**Crit Rate:** ${item.critRate}%\n**Crit Damage:** ${item.critDamage}%`,
        inline: true
      });
    } else if (item.type === 'armor') {
      embed.addFields({
        name: '🛡️ Armor Stats',
        value: `**Defense:** ${item.defense}\n**HP Bonus:** ${item.healthBonus || 0}\n**MP Bonus:** ${item.manaBonus || 0}`,
        inline: true
      });
    }
    
    // Plagg's comment
    if (item.plaggComment) {
      embed.addFields({
        name: '🧀 Plagg\'s Opinion',
        value: `*"${item.plaggComment}"*`,
        inline: false
      });
    }
    
    return embed;
  }
  
  // Create combat embed
  static createCombatEmbed(player: Player, monster: any, playerHealth: number, monsterHealth: number): EmbedBuilder {
    const embed = this.createGameEmbed(`⚔️ Combat: ${player.username} vs ${monster.name}`, null, 0xDC2626);
    
    // Health bars
    const playerHealthBar = this.createHealthBar(playerHealth, player.maxHealth);
    const monsterHealthBar = this.createHealthBar(monsterHealth, monster.health);
    
    embed.addFields(
      {
        name: `👤 ${player.username}`,
        value: `${playerHealthBar}\nHP: ${playerHealth}/${player.maxHealth}`,
        inline: true
      },
      {
        name: '🆚',
        value: '⚔️',
        inline: true
      },
      {
        name: `👹 ${monster.name}`,
        value: `${monsterHealthBar}\nHP: ${monsterHealth}/${monster.health}`,
        inline: true
      }
    );
    
    return embed;
  }
  
  // Create dungeon embed
  static createDungeonEmbed(dungeon: any, floor: number, roomsCleared: number, totalRooms: number): EmbedBuilder {
    const embed = this.createGameEmbed(`🏰 ${dungeon.name}`, dungeon.description, 0x7C3AED);
    
    const progressBar = this.createProgressBar(roomsCleared, totalRooms);
    
    embed.addFields(
      {
        name: '📍 Current Location',
        value: `**Floor:** ${floor}\n**Progress:** ${progressBar}\n**Rooms:** ${roomsCleared}/${totalRooms}`,
        inline: false
      }
    );
    
    if (dungeon.plaggComment) {
      embed.addFields({
        name: '🧀 Plagg\'s Take',
        value: `*"${dungeon.plaggComment}"*`,
        inline: false
      });
    }
    
    return embed;
  }
  
  // Create market embed
  static createMarketEmbed(listings: any[]): EmbedBuilder {
    const embed = this.createGameEmbed('🏪 Market', 'Browse items for sale', 0x059669);
    
    if (listings.length === 0) {
      embed.setDescription('The market is empty. Be the first to list an item!');
      return embed;
    }
    
    listings.slice(0, 10).forEach((listing, index) => {
      const timeLeft = Math.max(0, Math.floor((listing.expiresAt.getTime() - Date.now()) / 1000 / 60));
      embed.addFields({
        name: `${index + 1}. ${listing.itemName}`,
        value: `**Price:** ${listing.price.toLocaleString()} 🪙\n**Seller:** ${listing.sellerId}\n**Time Left:** ${timeLeft}m`,
        inline: true
      });
    });
    
    return embed;
  }
  
  // Create leaderboard embed
  static createLeaderboardEmbed(players: Player[], type: string): EmbedBuilder {
    const embed = this.createGameEmbed(`🏆 ${type} Leaderboard`, null, 0xF59E0B);
    
    if (players.length === 0) {
      embed.setDescription('No players found.');
      return embed;
    }
    
    const leaderboardText = players.slice(0, 10).map((player, index) => {
      const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
      let value: string;
      
      switch (type.toLowerCase()) {
        case 'level':
          value = `Level ${player.level}`;
          break;
        case 'gold':
          value = `${player.gold.toLocaleString()} 🪙`;
          break;
        case 'elo':
          value = `${player.elo} ELO`;
          break;
        default:
          value = 'N/A';
      }
      
      return `${medal} **${player.username}** - ${value}`;
    }).join('\n');
    
    embed.setDescription(leaderboardText);
    return embed;
  }
  
  // Helper: Create health bar visualization
  private static createHealthBar(current: number, max: number, length: number = 10): string {
    const percentage = Math.max(0, Math.min(1, current / max));
    const filled = Math.floor(percentage * length);
    const empty = length - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const color = percentage > 0.6 ? '🟩' : percentage > 0.3 ? '🟨' : '🟥';
    
    return `${color} ${bar} ${Math.round(percentage * 100)}%`;
  }
  
  // Helper: Create progress bar
  private static createProgressBar(current: number, max: number, length: number = 10): string {
    const percentage = Math.max(0, Math.min(1, current / max));
    const filled = Math.floor(percentage * length);
    const empty = length - filled;
    
    return `${'▰'.repeat(filled)}${'▱'.repeat(empty)} ${current}/${max}`;
  }
}
