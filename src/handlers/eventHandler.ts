import { Client, Message } from 'discord.js';
import { prisma } from '../index.js';
import { config } from '../config.js';

export function eventHandler(client: Client) {
  // Bot ready event
  client.once('ready', () => {
    console.log(`🎭 ${client.user?.tag} is now online!`);
    console.log(`🌍 Serving ${client.guilds.cache.size} guilds`);
    
    // Set bot activity
    client.user?.setActivity('🧀 Plagg RPG | $help', { type: 'PLAYING' });
  });
  
  // Message event for command handling
  client.on('messageCreate', async (message: Message) => {
    // Ignore bots and messages without prefix
    if (message.author.bot || !message.content.startsWith('$')) return;
    
    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    
    if (!commandName) return;
    
    const command = client.commands.get(commandName);
    if (!command) return;
    
    // Check admin-only commands
    if (command.adminOnly && message.author.id !== config.OWNER_ID) {
      return message.reply('❌ This command is restricted to the bot owner.');
    }
    
    try {
      // Initialize player if they don't exist
      await ensurePlayerExists(message.author.id, message.author.username);
      
      // Execute command
      await command.execute(message, args);
      
    } catch (error) {
      console.error(`❌ Error executing command ${commandName}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      message.reply(`❌ **Error:** ${errorMessage}`).catch(console.error);
    }
  });
  
  // Error handling
  client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
  });
  
  client.on('warn', (warning) => {
    console.warn('⚠️  Discord client warning:', warning);
  });
}

// Helper function to ensure player exists in database
async function ensurePlayerExists(discordId: string, username: string) {
  try {
    const existingPlayer = await prisma.player.findUnique({
      where: { discordId }
    });
    
    if (!existingPlayer) {
      await prisma.player.create({
        data: {
          discordId,
          username,
        }
      });
      console.log(`👤 Created new player: ${username} (${discordId})`);
    }
  } catch (error) {
    console.error('❌ Error ensuring player exists:', error);
  }
}
