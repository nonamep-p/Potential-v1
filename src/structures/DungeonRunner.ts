import { PrismaClient, Player, DungeonSession } from '@prisma/client';
import { Dungeon, Monster } from '../types.js';
import { loadGameData } from '../utils/gameUtils.js';
import { CombatManager } from './CombatManager.js';

interface DungeonProgress {
  currentFloor: number;
  roomsCleared: number;
  totalRooms: number;
  currentMonster?: Monster;
  treasuresFound: string[];
  playerHealth: number;
  playerMana: number;
}

export class DungeonRunner {
  private prisma: PrismaClient;
  private dungeons: Dungeon[];
  private monsters: Monster[];
  private combatManager: CombatManager;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.dungeons = [];
    this.monsters = [];
    this.combatManager = new CombatManager(prisma);
    this.loadData();
  }
  
  private async loadData() {
    const gameData = await loadGameData();
    this.dungeons = gameData.dungeons;
    this.monsters = gameData.monsters;
  }
  
  // Start a new dungeon session
  async startDungeon(playerId: string, dungeonId: string): Promise<DungeonSession> {
    const player = await this.prisma.player.findUnique({
      where: { discordId: playerId }
    });
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    const dungeon = this.dungeons.find(d => d.id === dungeonId);
    if (!dungeon) {
      throw new Error('Dungeon not found');
    }
    
    // Check level requirement
    if (player.level < dungeon.minLevel) {
      throw new Error(`You need to be level ${dungeon.minLevel} to enter this dungeon!`);
    }
    
    // End any existing active session
    await this.prisma.dungeonSession.updateMany({
      where: {
        playerId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });
    
    // Create initial progress
    const initialProgress: DungeonProgress = {
      currentFloor: 1,
      roomsCleared: 0,
      totalRooms: 5, // Default rooms per floor
      treasuresFound: [],
      playerHealth: player.health,
      playerMana: player.mana,
    };
    
    // Create new session
    const session = await this.prisma.dungeonSession.create({
      data: {
        playerId,
        dungeonId,
        floor: 1,
        progress: JSON.stringify(initialProgress),
        isActive: true,
      }
    });
    
    return session;
  }
  
  // Get current dungeon session
  async getDungeonSession(playerId: string): Promise<DungeonSession | null> {
    return await this.prisma.dungeonSession.findFirst({
      where: {
        playerId,
        isActive: true
      }
    });
  }
  
  // Generate a random encounter for current floor
  generateEncounter(dungeon: Dungeon, floor: number): { type: 'monster' | 'treasure' | 'event', data: any } {
    const encounterRoll = Math.random();
    
    if (encounterRoll < 0.7) {
      // Monster encounter (70% chance)
      const availableMonsters = this.monsters.filter(m => 
        dungeon.monsters.includes(m.id) && 
        m.level <= floor + 2 && 
        m.level >= Math.max(1, floor - 1)
      );
      
      if (availableMonsters.length === 0) {
        // Fallback to any monster from the dungeon
        const fallbackMonsters = this.monsters.filter(m => dungeon.monsters.includes(m.id));
        const monster = fallbackMonsters[Math.floor(Math.random() * fallbackMonsters.length)];
        return { type: 'monster', data: { ...monster, health: monster.health } };
      }
      
      const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
      return { type: 'monster', data: { ...monster, health: monster.health } };
      
    } else if (encounterRoll < 0.9) {
      // Treasure encounter (20% chance)
      const treasureRoll = Math.random();
      let reward;
      
      if (treasureRoll < 0.4) {
        reward = { type: 'gold', amount: Math.floor(50 + (floor * 25) + Math.random() * 100) };
      } else if (treasureRoll < 0.7) {
        reward = { type: 'xp', amount: Math.floor(25 + (floor * 15) + Math.random() * 50) };
      } else {
        // Item reward - would need item generation logic
        reward = { type: 'item', itemId: 'health_potion', quantity: 1 };
      }
      
      return { type: 'treasure', data: reward };
      
    } else {
      // Special event (10% chance)
      const events = [
        {
          name: 'Mysterious Fountain',
          description: 'A glowing fountain appears before you.',
          choices: [
            { text: 'Drink from it', effect: 'heal', value: 50 },
            { text: 'Ignore it', effect: 'none', value: 0 }
          ]
        },
        {
          name: 'Ancient Shrine',
          description: 'An ancient shrine emanates magical energy.',
          choices: [
            { text: 'Pray at the shrine', effect: 'mana', value: 30 },
            { text: 'Leave it alone', effect: 'none', value: 0 }
          ]
        }
      ];
      
      const event = events[Math.floor(Math.random() * events.length)];
      return { type: 'event', data: event };
    }
  }
  
  // Progress through dungeon room
  async progressRoom(playerId: string, choice?: string): Promise<{
    encounter: any;
    progress: DungeonProgress;
    completed: boolean;
    message: string;
  }> {
    const session = await this.getDungeonSession(playerId);
    if (!session) {
      throw new Error('No active dungeon session found');
    }
    
    const dungeon = this.dungeons.find(d => d.id === session.dungeonId);
    if (!dungeon) {
      throw new Error('Dungeon not found');
    }
    
    const progress: DungeonProgress = JSON.parse(session.progress);
    
    // Generate encounter for this room
    const encounter = this.generateEncounter(dungeon, session.floor);
    
    let message = '';
    let completed = false;
    
    // Process encounter based on type
    switch (encounter.type) {
      case 'treasure':
        const reward = encounter.data;
        if (reward.type === 'gold') {
          await this.prisma.player.update({
            where: { discordId: playerId },
            data: { gold: { increment: reward.amount } }
          });
          message = `💰 Found ${reward.amount} gold!`;
        } else if (reward.type === 'xp') {
          await this.prisma.player.update({
            where: { discordId: playerId },
            data: { xp: { increment: reward.amount } }
          });
          message = `⭐ Gained ${reward.amount} XP!`;
        }
        progress.treasuresFound.push(reward.type);
        break;
        
      case 'event':
        if (choice) {
          const choiceData = encounter.data.choices.find((c: any) => c.text === choice);
          if (choiceData) {
            if (choiceData.effect === 'heal') {
              progress.playerHealth = Math.min(progress.playerHealth + choiceData.value, 100);
              message = `💚 Restored ${choiceData.value} health!`;
            } else if (choiceData.effect === 'mana') {
              progress.playerMana = Math.min(progress.playerMana + choiceData.value, 100);
              message = `💙 Restored ${choiceData.value} mana!`;
            }
          }
        } else {
          // Return event for player to choose
          return { encounter, progress, completed: false, message: 'Choose your action:' };
        }
        break;
        
      case 'monster':
        // Monster encounters are handled separately in combat
        message = `⚔️ A wild ${encounter.data.name} appears!`;
        progress.currentMonster = encounter.data;
        break;
    }
    
    // Progress room counter
    progress.roomsCleared++;
    
    // Check if floor is completed
    if (progress.roomsCleared >= progress.totalRooms) {
      if (session.floor >= dungeon.maxFloors) {
        // Dungeon completed!
        completed = true;
        message += '\n🎉 Dungeon completed! Returning to surface...';
        
        // Give completion rewards
        const completionReward = Math.floor(100 + (session.floor * 50));
        await this.prisma.player.update({
          where: { discordId: playerId },
          data: { 
            gold: { increment: completionReward },
            xp: { increment: completionReward * 2 }
          }
        });
        
        // End session
        await this.prisma.dungeonSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });
        
      } else {
        // Next floor
        progress.currentFloor++;
        progress.roomsCleared = 0;
        progress.totalRooms = Math.min(7, 3 + progress.currentFloor); // Increase rooms per floor
        message += `\n🏃 Proceeding to floor ${progress.currentFloor}...`;
        
        await this.prisma.dungeonSession.update({
          where: { id: session.id },
          data: { 
            floor: progress.currentFloor,
            progress: JSON.stringify(progress)
          }
        });
      }
    } else {
      // Update progress
      await this.prisma.dungeonSession.update({
        where: { id: session.id },
        data: { progress: JSON.stringify(progress) }
      });
    }
    
    return { encounter, progress, completed, message };
  }
  
  // Flee from dungeon
  async fleeDungeon(playerId: string): Promise<void> {
    const session = await this.getDungeonSession(playerId);
    if (!session) {
      throw new Error('No active dungeon session found');
    }
    
    // End session with no rewards
    await this.prisma.dungeonSession.update({
      where: { id: session.id },
      data: { isActive: false }
    });
    
    // Reduce player health as penalty
    await this.prisma.player.update({
      where: { discordId: playerId },
      data: { health: { decrement: 10 } }
    });
  }
}
