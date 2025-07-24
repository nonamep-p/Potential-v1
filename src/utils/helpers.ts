import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Item, Monster, Dungeon, Scenario } from '../types.js';
import { DatabaseHelpers } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load game data
let weapons: Item[] = [];
let armor: Item[] = [];
let accessories: Item[] = [];
let consumables: Item[] = [];
let monsters: Monster[] = [];
let dungeons: Dungeon[] = [];
let scenarios: Scenario[] = [];

export async function loadGameData() {
    try {
        const dataPath = join(__dirname, '..', 'data');
        
        weapons = await import(join(dataPath, 'items', 'weapons.json')).then(m => m.default);
        armor = await import(join(dataPath, 'items', 'armor.json')).then(m => m.default);
        accessories = await import(join(dataPath, 'items', 'accessories.json')).then(m => m.default);
        consumables = await import(join(dataPath, 'items', 'consumables.json')).then(m => m.default);
        monsters = await import(join(dataPath, 'monsters.json')).then(m => m.default);
        dungeons = await import(join(dataPath, 'dungeons.json')).then(m => m.default);
        scenarios = await import(join(dataPath, 'scenarios.json')).then(m => m.default);
    } catch (error) {
        console.error('Failed to load game data:', error);
    }
}

export function getItemById(itemId: string): Item | undefined {
    return [...weapons, ...armor, ...accessories, ...consumables].find(item => item.id === itemId);
}

export function getMonsterById(monsterId: string): Monster | undefined {
    return monsters.find(monster => monster.id === monsterId);
}

export function getDungeonById(dungeonId: string): Dungeon | undefined {
    return dungeons.find(dungeon => dungeon.id === dungeonId);
}

export function getScenarioById(scenarioId: string): Scenario | undefined {
    return scenarios.find(scenario => scenario.id === scenarioId);
}

export function getRandomMonsterFromFloor(monsterIds: string[]): Monster | undefined {
    const randomId = monsterIds[Math.floor(Math.random() * monsterIds.length)];
    return getMonsterById(randomId);
}

export function getAllWeapons(): Item[] {
    return weapons;
}

export function getAllArmor(): Item[] {
    return armor;
}

export function getAllAccessories(): Item[] {
    return accessories;
}

export function getAllConsumables(): Item[] {
    return consumables;
}

export function getAllMonsters(): Monster[] {
    return monsters;
}

export function getAllDungeons(): Dungeon[] {
    return dungeons;
}

export function getAllScenarios(): Scenario[] {
    return scenarios;
}

export async function createPlayerIfNotExists(discordId: string, username: string) {
    return await DatabaseHelpers.getOrCreatePlayer(discordId, username);
}

export function calculateLevelFromXP(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function calculateXPNeeded(level: number): number {
    return Math.pow(level - 1, 2) * 100;
}

export function formatNumber(num: number): string {
    return num.toLocaleString();
}

export function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

export function getRarityColor(rarity: string): number {
    switch (rarity) {
        case 'common': return 0x808080;
        case 'uncommon': return 0x00ff00;
        case 'rare': return 0x0080ff;
        case 'epic': return 0x8000ff;
        case 'legendary': return 0xff8000;
        case 'mythic': return 0xff0080;
        default: return 0x808080;
    }
}

export function getRarityEmoji(rarity: string): string {
    switch (rarity) {
        case 'common': return '⚪';
        case 'uncommon': return '🟢';
        case 'rare': return '🔵';
        case 'epic': return '🟣';
        case 'legendary': return '🟠';
        case 'mythic': return '🔴';
        default: return '⚪';
    }
}

// Initialize game data
loadGameData();
