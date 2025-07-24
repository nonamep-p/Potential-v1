import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  WeaponSchema, 
  ArmorSchema, 
  AccessorySchema, 
  ConsumableSchema,
  MonsterSchema,
  DungeonSchema,
  ScenarioSchema,
  ClassSchema,
  Weapon,
  Armor,
  Accessory,
  Consumable,
  Monster,
  Dungeon,
  Scenario,
  Class
} from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for game data
let gameDataCache: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutes

export interface GameData {
  weapons: Weapon[];
  armor: Armor[];
  accessories: Accessory[];
  consumables: Consumable[];
  monsters: Monster[];
  dungeons: Dungeon[];
  scenarios: Scenario[];
  classes: Class[];
}

// Load all game data with caching
export async function loadGameData(): Promise<GameData> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (gameDataCache && (now - lastCacheTime) < CACHE_TTL) {
    return gameDataCache;
  }
  
  try {
    const dataPath = path.join(__dirname, '..', 'data');
    
    // Load and validate all data files
    const [weapons, armor, accessories, consumables, monsters, dungeons, scenarios, classes] = await Promise.all([
      loadJsonFile(path.join(dataPath, 'items', 'weapons.json'), WeaponSchema),
      loadJsonFile(path.join(dataPath, 'items', 'armor.json'), ArmorSchema),
      loadJsonFile(path.join(dataPath, 'items', 'accessories.json'), AccessorySchema),
      loadJsonFile(path.join(dataPath, 'items', 'consumables.json'), ConsumableSchema),
      loadJsonFile(path.join(dataPath, 'monsters.json'), MonsterSchema),
      loadJsonFile(path.join(dataPath, 'dungeons.json'), DungeonSchema),
      loadJsonFile(path.join(dataPath, 'scenarios.json'), ScenarioSchema),
      loadJsonFile(path.join(dataPath, 'classes.json'), ClassSchema),
    ]);
    
    gameDataCache = {
      weapons,
      armor,
      accessories,
      consumables,
      monsters,
      dungeons,
      scenarios,
      classes
    };
    
    lastCacheTime = now;
    console.log('✅ Game data loaded and validated');
    
    return gameDataCache;
    
  } catch (error) {
    console.error('❌ Error loading game data:', error);
    throw new Error('Failed to load game data');
  }
}

// Load and validate JSON file
async function loadJsonFile(filePath: string, schema: any): Promise<any[]> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    
    // Validate each item in the array
    const validatedData = jsonData.map((item: any, index: number) => {
      try {
        return schema.parse(item);
      } catch (error) {
        console.error(`❌ Validation error in ${filePath} at index ${index}:`, error);
        throw error;
      }
    });
    
    return validatedData;
  } catch (error) {
    console.error(`❌ Error loading ${filePath}:`, error);
    throw error;
  }
}

// Get item by ID from all item types
export async function getItemById(itemId: string): Promise<any | null> {
  const gameData = await loadGameData();
  
  // Search in all item arrays
  const allItems = [
    ...gameData.weapons,
    ...gameData.armor,
    ...gameData.accessories,
    ...gameData.consumables
  ];
  
  return allItems.find(item => item.id === itemId) || null;
}

// Get monster by ID
export async function getMonsterById(monsterId: string): Promise<Monster | null> {
  const gameData = await loadGameData();
  return gameData.monsters.find(monster => monster.id === monsterId) || null;
}

// Get dungeon by ID
export async function getDungeonById(dungeonId: string): Promise<Dungeon | null> {
  const gameData = await loadGameData();
  return gameData.dungeons.find(dungeon => dungeon.id === dungeonId) || null;
}

// Get scenario by ID
export async function getScenarioById(scenarioId: string): Promise<Scenario | null> {
  const gameData = await loadGameData();
  return gameData.scenarios.find(scenario => scenario.id === scenarioId) || null;
}

// Get class by ID
export async function getClassById(classId: string): Promise<Class | null> {
  const gameData = await loadGameData();
  return gameData.classes.find(cls => cls.id === classId) || null;
}

// Get items by rarity
export async function getItemsByRarity(rarity: string): Promise<any[]> {
  const gameData = await loadGameData();
  
  const allItems = [
    ...gameData.weapons,
    ...gameData.armor,
    ...gameData.accessories,
    ...gameData.consumables
  ];
  
  return allItems.filter(item => item.rarity === rarity);
}

// Get random item by rarity (for loot drops)
export async function getRandomItemByRarity(rarity: string): Promise<any | null> {
  const items = await getItemsByRarity(rarity);
  if (items.length === 0) return null;
  
  return items[Math.floor(Math.random() * items.length)];
}

// Calculate item rarity drop rates
export function calculateItemRarity(): string {
  const roll = Math.random() * 100;
  
  if (roll < 50) return 'common';      // 50%
  if (roll < 75) return 'uncommon';    // 25%
  if (roll < 90) return 'rare';        // 15%
  if (roll < 97) return 'epic';        // 7%
  if (roll < 99.5) return 'legendary'; // 2.5%
  return 'mythic';                     // 0.5%
}

// Generate random loot based on monster loot table
export async function generateLoot(monster: Monster): Promise<any[]> {
  const gameData = await loadGameData();
  const loot: any[] = [];
  
  // Process monster's loot table
  for (const lootEntry of monster.lootTable) {
    const roll = Math.random() * 100;
    
    if (roll <= lootEntry.chance) {
      const item = await getItemById(lootEntry.itemId);
      if (item) {
        loot.push({
          ...item,
          quantity: lootEntry.quantity || 1
        });
      }
    }
  }
  
  // Chance for random item based on monster level
  const randomItemChance = Math.min(20, monster.level * 2);
  if (Math.random() * 100 < randomItemChance) {
    const rarity = calculateItemRarity();
    const randomItem = await getRandomItemByRarity(rarity);
    if (randomItem) {
      loot.push({ ...randomItem, quantity: 1 });
    }
  }
  
  return loot;
}

// Check if player meets scenario trigger conditions
export async function checkScenarioTriggers(player: any): Promise<Scenario[]> {
  const gameData = await loadGameData();
  const completedScenarios = JSON.parse(player.completedScenariosJson);
  const triggeredScenarios: Scenario[] = [];
  
  for (const scenario of gameData.scenarios) {
    // Skip if already completed and it's a one-time scenario
    if (scenario.oneTime && completedScenarios.includes(scenario.id)) {
      continue;
    }
    
    // Check trigger conditions
    if (evaluateScenarioCondition(scenario.triggerCondition, player)) {
      triggeredScenarios.push(scenario);
    }
  }
  
  return triggeredScenarios;
}

// Evaluate scenario trigger conditions
function evaluateScenarioCondition(condition: string, player: any): boolean {
  try {
    // Simple condition evaluation
    // Format: "level >= 10", "gold > 1000", "class == 'Mage'"
    const [property, operator, value] = condition.split(' ');
    
    const playerValue = player[property];
    const conditionValue = isNaN(Number(value)) ? value.replace(/['"]/g, '') : Number(value);
    
    switch (operator) {
      case '>=': return playerValue >= conditionValue;
      case '<=': return playerValue <= conditionValue;
      case '>': return playerValue > conditionValue;
      case '<': return playerValue < conditionValue;
      case '==': return playerValue == conditionValue;
      case '!=': return playerValue != conditionValue;
      default: return false;
    }
  } catch (error) {
    console.error('Error evaluating scenario condition:', condition, error);
    return false;
  }
}

// Calculate XP required for next level
export function calculateXPForLevel(level: number): number {
  return Math.floor(Math.pow(level * 10, 2));
}

// Calculate total XP for a level
export function calculateTotalXPForLevel(level: number): number {
  let totalXP = 0;
  for (let i = 1; i < level; i++) {
    totalXP += calculateXPForLevel(i);
  }
  return totalXP;
}

// Generate random stats for level scaling
export function generateScaledStats(baseStats: any, level: number): any {
  const scalingFactor = 1 + ((level - 1) * 0.1); // 10% increase per level
  
  return {
    ...baseStats,
    health: Math.floor(baseStats.health * scalingFactor),
    attack: Math.floor(baseStats.attack * scalingFactor),
    defense: Math.floor(baseStats.defense * scalingFactor),
  };
}

// Utility function to format large numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Utility function to get random element from array
export function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Clear game data cache (useful for development)
export function clearGameDataCache(): void {
  gameDataCache = null;
  lastCacheTime = 0;
  console.log('🔄 Game data cache cleared');
}
