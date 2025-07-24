import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { commandHandler } from './handlers/commandHandler.js';
import { eventHandler } from './handlers/eventHandler.js';
import { TimedEventHandler } from './structures/TimedEventHandler.js';
import { startKeepAlive } from './keep_alive.js';

// Initialize Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

// Initialize Prisma client
export const prisma = new PrismaClient();

// Add commands collection to client
client.commands = new Collection();

async function main() {
  try {
    console.log('🎭 Starting Plagg Bot...');
    
    // Connect to database
    await prisma.$connect();
    console.log('📁 Database connected');
    
    // Load command handlers
    await commandHandler(client);
    console.log('⚡ Commands loaded');
    
    // Load event handlers
    eventHandler(client);
    console.log('🔥 Events loaded');
    
    // Start timed events (market auctions, etc.)
    TimedEventHandler.initialize(prisma);
    console.log('⏰ Timed events initialized');
    
    // Start keep-alive server for Replit
    startKeepAlive();
    console.log('🌐 Keep-alive server started');
    
    // Login to Discord
    await client.login(config.DISCORD_TOKEN);
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Start the bot
main();

// Extend Discord.js Client type to include commands
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, any>;
  }
}
