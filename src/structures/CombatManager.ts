import { PrismaClient, Player } from '@prisma/client';
import { Monster, CombatAction, CombatResult, Equipment, InventoryItem } from '../types.js';
import { loadGameData } from '../utils/gameUtils.js';

export class CombatManager {
  private prisma: PrismaClient;
  private monsters: Monster[];
  private items: any[];
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.monsters = [];
    this.items = [];
    this.loadData();
  }
  
  private async loadData() {
    const gameData = await loadGameData();
    this.monsters = gameData.monsters;
    this.items = [...gameData.weapons, ...gameData.armor, ...gameData.accessories, ...gameData.consumables];
  }
  
  // Calculate total damage using the specified formula
  calculateDamage(attacker: any, target: any, weapon?: any): CombatResult {
    let baseDamage: number;
    let isCritical = false;
    let isWeaknessBreak = false;
    
    // Determine base damage source (STR for physical, INT for magical)
    const attackStat = weapon?.weaponType === 'staff' ? attacker.intelligence : attacker.strength;
    const weaponAttack = weapon?.attack || 0;
    
    // Base damage calculation: (STR|INT * 0.5) + weapon.atk
    baseDamage = (attackStat * 0.5) + weaponAttack;
    
    // Apply defense: damage * (100 / (100 + target.def))
    const defenseReduction = 100 / (100 + target.defense);
    let finalDamage = baseDamage * defenseReduction;
    
    // Critical hit calculation
    const critRate = weapon?.critRate || 5;
    const critDamage = weapon?.critDamage || 150;
    
    if (Math.random() * 100 < critRate) {
      isCritical = true;
      finalDamage *= (critDamage / 100);
    }
    
    // Weakness break system
    if (target.weaknesses && weapon) {
      const weaponElement = weapon.element || 'physical';
      if (target.weaknesses.includes(weaponElement)) {
        isWeaknessBreak = true;
        finalDamage *= 1.5; // 50% bonus damage for weakness
      }
    }
    
    // Apply random variance (±10%)
    const variance = 0.9 + (Math.random() * 0.2);
    finalDamage *= variance;
    
    // Round down as specified in formula
    finalDamage = Math.floor(finalDamage);
    
    // Ensure minimum damage of 1
    finalDamage = Math.max(1, finalDamage);
    
    let message = `💥 Dealt ${finalDamage} damage`;
    if (isCritical) message += ' (Critical Hit!)';
    if (isWeaknessBreak) message += ' (Weakness Break!)';
    
    return {
      damage: finalDamage,
      isCritical,
      isWeaknessBreak,
      statusEffects: [],
      message
    };
  }
  
  // Get player's combat stats including equipment
  async getPlayerCombatStats(player: Player): Promise<any> {
    const equipment: Equipment = JSON.parse(player.equipmentJson);
    const inventory: InventoryItem[] = JSON.parse(player.inventoryJson);
    
    let totalStats = {
      health: player.health,
      maxHealth: player.maxHealth,
      mana: player.mana,
      maxMana: player.maxMana,
      strength: player.strength,
      intelligence: player.intelligence,
      defense: player.defense,
      agility: player.agility,
      luck: player.luck,
    };
    
    // Apply equipment bonuses
    for (const [slot, itemId] of Object.entries(equipment)) {
      if (itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
          if (item.type === 'weapon') {
            // Weapon stats handled separately in damage calculation
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
  
  // Execute a combat action
  async executeCombatAction(playerId: string, action: CombatAction, target: Monster): Promise<CombatResult> {
    const player = await this.prisma.player.findUnique({
      where: { discordId: playerId }
    });
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    const playerStats = await this.getPlayerCombatStats(player);
    const equipment: Equipment = JSON.parse(player.equipmentJson);
    
    switch (action.type) {
      case 'attack':
        const weapon = equipment.weapon ? this.items.find(i => i.id === equipment.weapon) : null;
        return this.calculateDamage(playerStats, target, weapon);
        
      case 'defend':
        // Defending reduces incoming damage by 50% for the turn
        return {
          damage: 0,
          isCritical: false,
          isWeaknessBreak: false,
          statusEffects: ['defending'],
          message: '🛡️ Defending! Incoming damage reduced by 50%'
        };
        
      case 'skill':
        // Skill implementation would go here
        // For now, return basic attack
        return this.calculateDamage(playerStats, target);
        
      case 'item':
        // Item usage implementation
        return {
          damage: 0,
          isCritical: false,
          isWeaknessBreak: false,
          statusEffects: [],
          message: '🧪 Used item'
        };
        
      default:
        throw new Error('Invalid combat action');
    }
  }
  
  // Calculate monster damage to player
  calculateMonsterDamage(monster: Monster, player: any): CombatResult {
    // Monsters use simpler damage calculation
    let baseDamage = monster.attack;
    
    // Apply player defense
    const defenseReduction = 100 / (100 + player.defense);
    let finalDamage = baseDamage * defenseReduction;
    
    // Random variance
    const variance = 0.9 + (Math.random() * 0.2);
    finalDamage *= variance;
    
    finalDamage = Math.floor(Math.max(1, finalDamage));
    
    return {
      damage: finalDamage,
      isCritical: false,
      isWeaknessBreak: false,
      statusEffects: [],
      message: `🗡️ ${monster.name} attacks for ${finalDamage} damage!`
    };
  }
  
  // Process combat turn
  async processCombatTurn(playerId: string, playerAction: CombatAction, monster: Monster): Promise<{
    playerResult: CombatResult;
    monsterResult: CombatResult;
    playerHealth: number;
    monsterHealth: number;
  }> {
    const player = await this.prisma.player.findUnique({
      where: { discordId: playerId }
    });
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    const playerStats = await this.getPlayerCombatStats(player);
    
    // Player acts first (can be modified by agility later)
    const playerResult = await this.executeCombatAction(playerId, playerAction, monster);
    
    // Apply damage to monster
    monster.health -= playerResult.damage;
    
    let monsterResult: CombatResult = {
      damage: 0,
      isCritical: false,
      isWeaknessBreak: false,
      statusEffects: [],
      message: ''
    };
    
    // Monster attacks back if still alive
    if (monster.health > 0) {
      monsterResult = this.calculateMonsterDamage(monster, playerStats);
      
      // Apply damage to player (reduced if defending)
      let actualDamage = monsterResult.damage;
      if (playerResult.statusEffects.includes('defending')) {
        actualDamage = Math.floor(actualDamage * 0.5);
        monsterResult.message += ' (Reduced by defense!)';
      }
      
      playerStats.health -= actualDamage;
    }
    
    return {
      playerResult,
      monsterResult,
      playerHealth: Math.max(0, playerStats.health),
      monsterHealth: Math.max(0, monster.health)
    };
  }
}
