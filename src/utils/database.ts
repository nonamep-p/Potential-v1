import { PrismaClient } from '@prisma/client';

// Create a singleton Prisma client instance
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, use a global variable to preserve the instance across hot reloads
  if (!(global as any).prisma) {
    (global as any).prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = (global as any).prisma;
}

export { prisma };

// Database utility functions
export async function initializeDatabase() {
  try {
    await prisma.$connect();
    console.log('📁 Database connected successfully');
    
    // Run any necessary migrations or setup
    await ensureDefaultData();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Ensure default data exists
async function ensureDefaultData() {
  try {
    // Check if we need to create any default game data
    const playerCount = await prisma.player.count();
    console.log(`👥 Current player count: ${playerCount}`);
    
  } catch (error) {
    console.error('❌ Error checking default data:', error);
  }
}

// Cleanup function for graceful shutdown
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    console.log('📁 Database disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting database:', error);
  }
}

// Legacy function exports for backwards compatibility
export async function getPlayer(discordId: string) {
  return await DatabaseHelpers.getPlayer(discordId);
}

export async function createPlayer(discordId: string, username: string) {
  return await DatabaseHelpers.getOrCreatePlayer(discordId, username);
}

export async function updatePlayer(discordId: string, updates: any) {
  return await DatabaseHelpers.updatePlayerStats(discordId, updates);
}

export async function getAllPlayers() {
  return await prisma.player.findMany();
}

// Market listing functions
export async function getMarketListings(auctionsOnly: boolean = false) {
  // For now, return empty array - you'll need to create MarketListing model in Prisma
  return [];
}

export async function createMarketListing(data: any) {
  // For now, return mock data - you'll need to create MarketListing model in Prisma
  return { id: 'temp-id', ...data };
}

export async function updateMarketListing(id: string, updates: any) {
  // For now, return mock data - you'll need to create MarketListing model in Prisma
  return { id, ...updates };
}

export async function deleteMarketListing(id: string) {
  // For now, return true - you'll need to create MarketListing model in Prisma
  return true;
}

// Helper functions for common database operations
export const DatabaseHelpers = {
  // Get or create player
  async getOrCreatePlayer(discordId: string, username: string) {
    return await prisma.player.upsert({
      where: { discordId },
      update: { username }, // Update username in case it changed
      create: {
        discordId,
        username,
      }
    });
  },
  
  // Get player with error handling
  async getPlayer(discordId: string) {
    const player = await prisma.player.findUnique({
      where: { discordId }
    });
    
    if (!player) {
      throw new Error('Player not found. Use `$startrpg` to begin your adventure!');
    }
    
    return player;
  },
  
  // Update player stats safely
  async updatePlayerStats(discordId: string, updates: any) {
    return await prisma.player.update({
      where: { discordId },
      data: updates
    });
  },
  
  // Get player inventory
  async getPlayerInventory(discordId: string) {
    const player = await this.getPlayer(discordId);
    return JSON.parse(player.inventoryJson);
  },
  
  // Update player inventory
  async updatePlayerInventory(discordId: string, inventory: any[]) {
    return await prisma.player.update({
      where: { discordId },
      data: { inventoryJson: JSON.stringify(inventory) }
    });
  },
  
  // Get player equipment
  async getPlayerEquipment(discordId: string) {
    const player = await this.getPlayer(discordId);
    return JSON.parse(player.equipmentJson);
  },
  
  // Update player equipment
  async updatePlayerEquipment(discordId: string, equipment: any) {
    return await prisma.player.update({
      where: { discordId },
      data: { equipmentJson: JSON.stringify(equipment) }
    });
  },
  
  // Add item to inventory
  async addItemToInventory(discordId: string, itemId: string, quantity: number = 1) {
    const inventory = await this.getPlayerInventory(discordId);
    
    const existingItem = inventory.find((item: any) => item.itemId === itemId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      inventory.push({ itemId, quantity, enchantLevel: 0 });
    }
    
    await this.updatePlayerInventory(discordId, inventory);
    return inventory;
  },
  
  // Remove item from inventory
  async removeItemFromInventory(discordId: string, itemId: string, quantity: number = 1) {
    const inventory = await this.getPlayerInventory(discordId);
    
    const itemIndex = inventory.findIndex((item: any) => item.itemId === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found in inventory');
    }
    
    const item = inventory[itemIndex];
    if (item.quantity < quantity) {
      throw new Error('Not enough items in inventory');
    }
    
    item.quantity -= quantity;
    if (item.quantity <= 0) {
      inventory.splice(itemIndex, 1);
    }
    
    await this.updatePlayerInventory(discordId, inventory);
    return inventory;
  },
  
  // Check if player can afford something
  async canAfford(discordId: string, cost: number) {
    const player = await this.getPlayer(discordId);
    return player.gold >= cost;
  },
  
  // Deduct gold from player
  async deductGold(discordId: string, amount: number) {
    const player = await this.getPlayer(discordId);
    if (player.gold < amount) {
      throw new Error('Insufficient gold');
    }
    
    return await prisma.player.update({
      where: { discordId },
      data: { gold: { decrement: amount } }
    });
  },
  
  // Add gold to player
  async addGold(discordId: string, amount: number) {
    return await prisma.player.update({
      where: { discordId },
      data: { gold: { increment: amount } }
    });
  },
  
  // Add XP and handle level ups
  async addXP(discordId: string, amount: number) {
    const player = await this.getPlayer(discordId);
    const newXP = player.xp + amount;
    
    // Calculate new level (simple formula: level = floor(sqrt(xp/100)) + 1)
    const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;
    const levelUp = newLevel > player.level;
    
    const updates: any = { xp: newXP };
    
    if (levelUp) {
      updates.level = newLevel;
      // Increase stats on level up
      updates.strength = { increment: 2 };
      updates.intelligence = { increment: 2 };
      updates.defense = { increment: 1 };
      updates.agility = { increment: 1 };
      updates.luck = { increment: 1 };
      updates.maxHealth = { increment: 5 };
      updates.maxMana = { increment: 3 };
      updates.health = updates.maxHealth; // Full heal on level up
      updates.mana = updates.maxMana;
    }
    
    await prisma.player.update({
      where: { discordId },
      data: updates
    });
    
    return { levelUp, newLevel, newXP };
  }
};
