import { Client, Collection } from 'discord.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function commandHandler(client: Client) {
  client.commands = new Collection<string, Command>();
  
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFolders = await fs.readdir(commandsPath);
  
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const stat = await fs.stat(folderPath);
    
    if (stat.isDirectory()) {
      const commandFiles = await fs.readdir(folderPath);
      
      for (const file of commandFiles) {
        if (file.endsWith('.ts') || file.endsWith('.js')) {
          try {
            const filePath = path.join(folderPath, file);
            const commandModule = await import(filePath);
            const command: Command = commandModule.default || commandModule;
            
            if (command && command.name && command.execute) {
              client.commands.set(command.name, command);
              console.log(`✅ Loaded command: ${command.name} (${folder})`);
            } else {
              console.warn(`⚠️  Command file ${file} is missing required properties`);
            }
          } catch (error) {
            console.error(`❌ Error loading command ${file}:`, error);
          }
        }
      }
    }
  }
  
  console.log(`📦 Loaded ${client.commands.size} commands`);
}
