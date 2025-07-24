import { z } from 'zod';

// Base item schema
export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['weapon', 'armor', 'accessory', 'consumable']),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']),
  description: z.string(),
  plaggComment: z.string(),
  value: z.number().min(0),
  level: z.number().min(1).default(1),
});

// Weapon schema
export const WeaponSchema = ItemSchema.extend({
  type: z.literal('weapon'),
  attack: z.number().min(0),
  critRate: z.number().min(0).max(100).default(5),
  critDamage: z.number().min(100).default(150),
  weaponType: z.enum(['sword', 'bow', 'staff', 'dagger', 'axe', 'hammer']),
});

// Armor schema  
export const ArmorSchema = ItemSchema.extend({
  type: z.literal('armor'),
  defense: z.number().min(0),
  slot: z.enum(['helmet', 'chest', 'legs', 'boots', 'gloves']),
  healthBonus: z.number().default(0),
  manaBonus: z.number().default(0),
});

// Accessory schema
export const AccessorySchema = ItemSchema.extend({
  type: z.literal('accessory'),
  slot: z.enum(['ring', 'necklace', 'earring']),
  statBonus: z.record(z.string(), z.number()).default({}),
});

// Consumable schema
export const ConsumableSchema = ItemSchema.extend({
  type: z.literal('consumable'),
  effect: z.string(),
  effectValue: z.number(),
  stackable: z.boolean().default(true),
  maxStack: z.number().default(99),
});

// Monster schema
export const MonsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().min(1),
  health: z.number().min(1),
  attack: z.number().min(1),
  defense: z.number().min(0),
  xpReward: z.number().min(0),
  goldReward: z.number().min(0),
  lootTable: z.array(z.object({
    itemId: z.string(),
    chance: z.number().min(0).max(100),
    quantity: z.number().min(1).default(1),
  })).default([]),
  weaknesses: z.array(z.string()).default([]),
  resistances: z.array(z.string()).default([]),
  description: z.string(),
  plaggComment: z.string(),
});

// Dungeon schema
export const DungeonSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  minLevel: z.number().min(1),
  maxFloors: z.number().min(1),
  monsters: z.array(z.string()),
  rewards: z.array(z.object({
    itemId: z.string(),
    chance: z.number().min(0).max(100),
    floor: z.number().min(1),
  })),
  plaggComment: z.string(),
});

// Scenario schema (Isekai scenarios)
export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  triggerCondition: z.string(),
  choices: z.array(z.object({
    text: z.string(),
    outcome: z.string(),
    rewards: z.record(z.string(), z.number()).default({}),
  })),
  plaggComment: z.string(),
  oneTime: z.boolean().default(true),
});

// Class schema
export const ClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  statBonus: z.object({
    strength: z.number().default(0),
    intelligence: z.number().default(0),
    defense: z.number().default(0),
    agility: z.number().default(0),
    luck: z.number().default(0),
  }),
  skills: z.array(z.object({
    name: z.string(),
    description: z.string(),
    cost: z.number(),
    cooldown: z.number().default(0),
  })),
  plaggComment: z.string(),
});

// Player inventory and equipment schemas
export const InventoryItemSchema = z.object({
  itemId: z.string(),
  quantity: z.number().min(1),
  enchantLevel: z.number().min(0).default(0),
});

export const EquipmentSchema = z.object({
  weapon: z.string().optional(),
  helmet: z.string().optional(),
  chest: z.string().optional(),
  legs: z.string().optional(),
  boots: z.string().optional(),
  gloves: z.string().optional(),
  ring1: z.string().optional(),
  ring2: z.string().optional(),
  necklace: z.string().optional(),
});

// Combat schemas
export const CombatActionSchema = z.object({
  type: z.enum(['attack', 'defend', 'skill', 'item']),
  targetId: z.string().optional(),
  skillId: z.string().optional(),
  itemId: z.string().optional(),
});

export const CombatResultSchema = z.object({
  damage: z.number(),
  isCritical: z.boolean(),
  isWeaknessBreak: z.boolean(),
  statusEffects: z.array(z.string()).default([]),
  message: z.string(),
});

// Type exports
export type Item = z.infer<typeof ItemSchema>;
export type Weapon = z.infer<typeof WeaponSchema>;
export type Armor = z.infer<typeof ArmorSchema>;
export type Accessory = z.infer<typeof AccessorySchema>;
export type Consumable = z.infer<typeof ConsumableSchema>;
export type Monster = z.infer<typeof MonsterSchema>;
export type Dungeon = z.infer<typeof DungeonSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Class = z.infer<typeof ClassSchema>;
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type Equipment = z.infer<typeof EquipmentSchema>;
export type CombatAction = z.infer<typeof CombatActionSchema>;
export type CombatResult = z.infer<typeof CombatResultSchema>;

// Command interface
export interface Command {
  name: string;
  description: string;
  category: string;
  cooldown?: number;
  adminOnly?: boolean;
  execute: (message: any, args: string[]) => Promise<void>;
}

// Rarity colors for embeds
export const RARITY_COLORS = {
  common: 0x9CA3AF,     // Gray
  uncommon: 0x10B981,   // Green
  rare: 0x3B82F6,       // Blue
  epic: 0x8B5CF6,       // Purple
  legendary: 0xF59E0B,  // Orange
  mythic: 0xEF4444,     // Red
} as const;

// Status effect types
export const STATUS_EFFECTS = {
  POISON: 'poison',
  BURN: 'burn',
  FREEZE: 'freeze',
  STUN: 'stun',
  SHIELD: 'shield',
  REGENERATION: 'regeneration',
  STRENGTH_BOOST: 'strengthBoost',
  WEAKNESS: 'weakness',
} as const;
