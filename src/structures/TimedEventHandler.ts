import { PrismaClient } from '@prisma/client';
import NodeCache from 'node-cache';

export class TimedEventHandler {
  private static instance: TimedEventHandler;
  private prisma: PrismaClient;
  private cache: NodeCache;
  private intervals: NodeJS.Timeout[] = [];
  
  private constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache
  }
  
  static initialize(prisma: PrismaClient): TimedEventHandler {
    if (!TimedEventHandler.instance) {
      TimedEventHandler.instance = new TimedEventHandler(prisma);
      TimedEventHandler.instance.startTimedEvents();
    }
    return TimedEventHandler.instance;
  }
  
  static getInstance(): TimedEventHandler {
    if (!TimedEventHandler.instance) {
      throw new Error('TimedEventHandler not initialized');
    }
    return TimedEventHandler.instance;
  }
  
  private startTimedEvents() {
    console.log('⏰ Starting timed events...');
    
    // Market auction expiration check (every 60 seconds)
    const marketInterval = setInterval(() => {
      this.processExpiredAuctions();
    }, 60000);
    this.intervals.push(marketInterval);
    
    // Daily reset check (every hour)
    const dailyInterval = setInterval(() => {
      this.processDailyResets();
    }, 3600000);
    this.intervals.push(dailyInterval);
    
    // Player health regeneration (every 5 minutes)
    const regenInterval = setInterval(() => {
      this.processHealthRegeneration();
    }, 300000);
    this.intervals.push(regenInterval);
    
    // Dungeon session cleanup (every 30 minutes)
    const cleanupInterval = setInterval(() => {
      this.cleanupStaleData();
    }, 1800000);
    this.intervals.push(cleanupInterval);
  }
  
  // Process expired market auctions
  private async processExpiredAuctions() {
    try {
      const expiredAuctions = await this.prisma.marketListing.findMany({
        where: {
          isAuction: true,
          expiresAt: {
            lte: new Date()
          }
        }
      });
      
      for (const auction of expiredAuctions) {
        console.log(`⏰ Processing expired auction: ${auction.itemName}`);
        
        // Return item to seller if no bids (simplified - would need bid tracking)
        // For now, just remove the listing
        await this.prisma.marketListing.delete({
          where: { id: auction.id }
        });
        
        console.log(`🔄 Removed expired auction: ${auction.itemName}`);
      }
      
      if (expiredAuctions.length > 0) {
        console.log(`✅ Processed ${expiredAuctions.length} expired auctions`);
      }
      
    } catch (error) {
      console.error('❌ Error processing expired auctions:', error);
    }
  }
  
  // Process daily resets for players
  private async processDailyResets() {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Find players who haven't done daily in over 24 hours
      const playersToReset = await this.prisma.player.findMany({
        where: {
          OR: [
            { lastDaily: null },
            { lastDaily: { lt: yesterday } }
          ]
        }
      });
      
      // Reset daily streak for players who missed their daily
      for (const player of playersToReset) {
        if (player.lastDaily && player.lastDaily < yesterday) {
          await this.prisma.player.update({
            where: { id: player.id },
            data: { dailyStreak: 0 }
          });
          console.log(`🔄 Reset daily streak for player: ${player.username}`);
        }
      }
      
      if (playersToReset.length > 0) {
        console.log(`✅ Processed daily resets for ${playersToReset.length} players`);
      }
      
    } catch (error) {
      console.error('❌ Error processing daily resets:', error);
    }
  }
  
  // Process health regeneration for players
  private async processHealthRegeneration() {
    try {
      // Regenerate health for players below max health
      const playersToHeal = await this.prisma.player.findMany({
        where: {
          health: {
            lt: { $column: 'maxHealth' } as any
          }
        }
      });
      
      for (const player of playersToHeal) {
        const healAmount = Math.min(5, player.maxHealth - player.health);
        if (healAmount > 0) {
          await this.prisma.player.update({
            where: { id: player.id },
            data: { health: { increment: healAmount } }
          });
        }
      }
      
      if (playersToHeal.length > 0) {
        console.log(`💚 Regenerated health for ${playersToHeal.length} players`);
      }
      
    } catch (error) {
      console.error('❌ Error processing health regeneration:', error);
    }
  }
  
  // Cleanup stale data
  private async cleanupStaleData() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Cleanup old dungeon sessions
      const deletedSessions = await this.prisma.dungeonSession.deleteMany({
        where: {
          isActive: false,
          updatedAt: { lt: oneDayAgo }
        }
      });
      
      // Cleanup old chat logs
      const deletedChatLogs = await this.prisma.chatLog.deleteMany({
        where: {
          createdAt: { lt: oneWeekAgo }
        }
      });
      
      // Cleanup expired market listings
      const deletedListings = await this.prisma.marketListing.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });
      
      console.log(`🧹 Cleanup completed:`);
      console.log(`  - Dungeon sessions: ${deletedSessions.count}`);
      console.log(`  - Chat logs: ${deletedChatLogs.count}`);
      console.log(`  - Market listings: ${deletedListings.count}`);
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
  
  // Get cached data with fallback
  getCachedData<T>(key: string, fallback: () => Promise<T>): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    
    return fallback().then(data => {
      this.cache.set(key, data);
      return data;
    });
  }
  
  // Set cached data
  setCachedData<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, data, ttl || 300);
  }
  
  // Clear cache
  clearCache(key?: string): void {
    if (key) {
      this.cache.del(key);
    } else {
      this.cache.flushAll();
    }
  }
  
  // Cleanup on shutdown
  shutdown(): void {
    console.log('🛑 Shutting down timed events...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }
}
