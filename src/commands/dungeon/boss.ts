import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { CombatManager } from '../../structures/CombatManager.js';
import { loadGameData } from '../../utils/gameUtils.js';
import { prisma } from '../../index.js';

const boss: Command = {
  name: 'boss',
  description: 'Challenge powerful boss monsters for legendary rewards',
  category: 'dungeon',
  cooldown: 120,
  
  async execute(message: Message, args: string[]) {
    try {
      const player = await DatabaseHelpers.getPlayer(message.author.id);
      const gameData = await loadGameData();
      
      if (args.length === 0) {
        // Show available bosses
        const embed = GameEmbedBuilder.createGameEmbed(
          '👑 Boss Challenges',
          'Face legendary monsters for incredible rewards!',
          0x7C2D12
        );
        
        // Define boss monsters (would be in data files in full implementation)
        const bosses = [
          {
            id: 'cheese_king',
            name: 'The Cheese King',
            level: 20,
            description: 'A massive golem made of aged cheese, wielding dairy-based magic',
            minLevel: 15,
            reward: '2000 🪙 + Legendary Cheese Sword',
            plaggComment: 'My cousin! He\'s actually pretty nice once you get past the smell.'
          },
          {
            id: 'shadow_lord',
            name: 'Shadow Lord Camembert',
            level: 35,
            description: 'An ancient evil that corrupts all dairy products it touches',
            minLevel: 30,
            reward: '5000 🪙 + Mythic Shadow Armor',
            plaggComment: 'This guy gives cheese a bad name. Defeat him for the honor of dairy!'
          },
          {
            id: 'dragon_gruyere',
            name: 'Ancient Dragon Gruyere',
            level: 50,
            description: 'The oldest and most powerful of all cheese dragons',
            minLevel: 45,
            reward: '10000 🪙 + Mythic Dragon Scale Equipment',
            plaggComment: 'Now THIS is a worthy opponent! Just don\'t let him melt you!'
          }
        ];
        
        bosses.forEach((boss, index) => {
          const statusIcon = player.level >= boss.minLevel ? '✅' : '🔒';
          embed.addFields({
            name: `${statusIcon} ${index + 1}. ${boss.name}`,
            value: `**Level:** ${boss.level} | **Min Level:** ${boss.minLevel}\n${boss.description}\n**Reward:** ${boss.reward}`,
            inline: false
          });
        });
        
        embed.addFields({
          name: '💡 How to Challenge',
          value: 'Use `$boss challenge <number>` to fight a boss\nMake sure you meet the level requirement!',
          inline: false
        });
        
        embed.addFields({
          name: '⚠️ Warning',
          value: 'Boss fights are extremely difficult and have a cooldown period. Prepare carefully!',
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      const action = args[0].toLowerCase();
      
      if (action === 'challenge') {
        if (!args[1]) {
          const embed = GameEmbedBuilder.createWarningEmbed(
            'Please specify which boss to challenge! Example: `$boss challenge 1`'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        const bossNumber = parseInt(args[1]);
        if (isNaN(bossNumber) || bossNumber < 1 || bossNumber > 3) {
          const embed = GameEmbedBuilder.createErrorEmbed(
            'Invalid boss number! Use `$boss` to see available bosses.'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        // Define boss data (would be from data files)
        const bossData = [
          { 
            id: 'cheese_king', 
            name: 'The Cheese King', 
            level: 20, 
            health: 800, 
            attack: 45, 
            defense: 25, 
            minLevel: 15,
            xpReward: 500,
            goldReward: 2000,
            description: 'A massive golem made of aged cheese'
          },
          { 
            id: 'shadow_lord', 
            name: 'Shadow Lord Camembert', 
            level: 35, 
            health: 1500, 
            attack: 70, 
            defense: 40, 
            minLevel: 30,
            xpReward: 1000,
            goldReward: 5000,
            description: 'An ancient evil that corrupts dairy products'
          },
          { 
            id: 'dragon_gruyere', 
            name: 'Ancient Dragon Gruyere', 
            level: 50, 
            health: 2500, 
            attack: 100, 
            defense: 60, 
            minLevel: 45,
            xpReward: 2000,
            goldReward: 10000,
            description: 'The oldest and most powerful cheese dragon'
          }
        ];
        
        const selectedBoss = bossData[bossNumber - 1];
        
        // Check level requirement
        if (player.level < selectedBoss.minLevel) {
          const embed = GameEmbedBuilder.createErrorEmbed(
            `You need to be level ${selectedBoss.minLevel} or higher to challenge ${selectedBoss.name}!`
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        // Check health requirement
        if (player.health < player.maxHealth * 0.8) {
          const embed = GameEmbedBuilder.createErrorEmbed(
            'You need at least 80% health to challenge a boss! Rest or heal first.'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        // Check if player is in a dungeon
        const dungeonSession = await prisma.dungeonSession.findFirst({
          where: {
            playerId: player.discordId,
            isActive: true
          }
        });
        
        if (dungeonSession) {
          const embed = GameEmbedBuilder.createErrorEmbed(
            'You cannot challenge bosses while in a dungeon. Complete or flee your current exploration first.'
          );
          await message.reply({ embeds: [embed] });
          return;
        }
        
        // Start boss fight
        await startBossFight(message, player, selectedBoss);
        
      } else if (action === 'status') {
        // Show boss challenge status
        const embed = GameEmbedBuilder.createGameEmbed(
          '📊 Boss Challenge Status',
          'Your legendary encounters and achievements',
          0x7C2D12
        );
        
        embed.addFields(
          {
            name: '🏆 Boss Victories',
            value: `**Bosses Defeated:** 0\n**Last Victory:** Never\n**Current Streak:** 0`,
            inline: true
          },
          {
            name: '💰 Boss Rewards',
            value: `**Total Gold Earned:** 0 🪙\n**Legendary Items:** 0\n**XP from Bosses:** 0`,
            inline: true
          }
        );
        
        embed.addFields({
          name: '⏰ Challenge Availability',
          value: 'All boss challenges are available!\nNo active cooldowns.',
          inline: false
        });
        
        embed.addFields({
          name: '🧀 Plagg\'s Encouragement',
          value: `*"You haven't defeated any bosses yet? Time to show them what happens when you mess with cheese lovers!"*`,
          inline: false
        });
        
        await message.reply({ embeds: [embed] });
        
      } else {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'Invalid boss command! Use:\n• `$boss` - View available bosses\n• `$boss challenge <number>` - Challenge a boss\n• `$boss status` - View your boss statistics'
        );
        await message.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to process boss command'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

async function startBossFight(message: Message, player: any, boss: any) {
  const combatManager = new CombatManager(prisma);
  
  // Create boss fight announcement
  const announceEmbed = GameEmbedBuilder.createGameEmbed(
    `👑 Boss Challenge: ${boss.name}`,
    `${player.username} steps forward to challenge the legendary ${boss.name}!`,
    0x7C2D12
  );
  
  announceEmbed.addFields(
    {
      name: '⚔️ Challenger',
      value: `**${player.username}**\nLevel ${player.level}\n${player.health}/${player.maxHealth} HP`,
      inline: true
    },
    {
      name: '🆚',
      value: '⚔️\n**VS**\n⚔️',
      inline: true
    },
    {
      name: '👑 Boss',
      value: `**${boss.name}**\nLevel ${boss.level}\n${boss.health}/${boss.health} HP`,
      inline: true
    }
  );
  
  announceEmbed.addFields({
    name: '🎲 Battle Begins!',
    value: 'The epic confrontation starts now...',
    inline: false
  });
  
  const battleMessage = await message.reply({ embeds: [announceEmbed] });
  
  // Simulate boss battle (simplified)
  let playerHP = player.health;
  let bossHP = boss.health;
  const battleLog: string[] = [];
  let turn = 1;
  const maxTurns = 30;
  
  const playerStats = await combatManager.getPlayerCombatStats(player);
  
  while (playerHP > 0 && bossHP > 0 && turn <= maxTurns) {
    // Player attacks first
    const playerDamage = Math.floor(
      ((playerStats.strength * 0.5) + (playerStats.weaponAttack || 0)) *
      (100 / (100 + boss.defense)) *
      (0.85 + Math.random() * 0.3) // More variance for boss fights
    );
    
    bossHP -= playerDamage;
    battleLog.push(`⚔️ ${player.username} deals ${playerDamage} damage!`);
    
    if (bossHP <= 0) break;
    
    // Boss attacks back with special abilities
    let bossDamage = Math.floor(
      boss.attack * (100 / (100 + playerStats.defense)) *
      (0.85 + Math.random() * 0.3)
    );
    
    // Boss special abilities every 3rd turn
    if (turn % 3 === 0) {
      bossDamage = Math.floor(bossDamage * 1.5);
      battleLog.push(`💥 ${boss.name} uses a devastating special attack!`);
    }
    
    playerHP = Math.max(0, playerHP - bossDamage);
    battleLog.push(`🗡️ ${boss.name} deals ${bossDamage} damage!`);
    
    turn++;
    
    // Add some delay for dramatic effect
    if (turn % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Determine outcome
  let resultEmbed: any;
  
  if (playerHP <= 0) {
    // Player defeated
    resultEmbed = GameEmbedBuilder.createGameEmbed(
      '💀 Boss Victory',
      `${boss.name} emerges victorious!`,
      0x7C2D12
    );
    
    resultEmbed.addFields({
      name: '😵 Defeat',
      value: `${player.username} fought valiantly but was overcome by the boss's power.\nYou lost 20% of your gold and were teleported to safety.`,
      inline: false
    });
    
    // Apply defeat penalties
    const goldLoss = Math.floor(player.gold * 0.2);
    await DatabaseHelpers.updatePlayerStats(player.discordId, {
      gold: { decrement: goldLoss },
      health: 1
    });
    
    resultEmbed.addFields({
      name: '💸 Penalties',
      value: `Lost ${goldLoss} 🪙\nHealth reduced to 1`,
      inline: true
    });
    
  } else if (bossHP <= 0) {
    // Player victory!
    resultEmbed = GameEmbedBuilder.createGameEmbed(
      '🏆 Legendary Victory!',
      `${player.username} has defeated ${boss.name}!`,
      0x10B981
    );
    
    resultEmbed.addFields({
      name: '🎉 Epic Win!',
      value: `Against all odds, you have slain the legendary ${boss.name}!\nYour name will be remembered in the halls of heroes!`,
      inline: false
    });
    
    // Award massive rewards
    await DatabaseHelpers.addXP(player.discordId, boss.xpReward);
    await DatabaseHelpers.addGold(player.discordId, boss.goldReward);
    
    // Add legendary item to inventory (simplified)
    const legendaryItem = boss.id === 'cheese_king' ? 'legendary_cheese_sword' : 
                         boss.id === 'shadow_lord' ? 'mythic_shadow_armor' :
                         'mythic_dragon_scales';
    
    await DatabaseHelpers.addItemToInventory(player.discordId, legendaryItem, 1);
    
    resultEmbed.addFields({
      name: '🎁 Legendary Rewards',
      value: `**XP Gained:** ${boss.xpReward}\n**Gold Earned:** ${boss.goldReward} 🪙\n**Legendary Item:** ${legendaryItem}`,
      inline: false
    });
    
  } else {
    // Draw (time limit reached)
    resultEmbed = GameEmbedBuilder.createGameEmbed(
      '⏰ Epic Stalemate',
      'The battle rages on, but both fighters are exhausted!',
      0x6B7280
    );
    
    resultEmbed.addFields({
      name: '🤝 Honorable Draw',
      value: 'After an epic battle, both you and the boss retreat to fight another day.\nYou gain some XP for your valiant effort.',
      inline: false
    });
    
    await DatabaseHelpers.addXP(player.discordId, Math.floor(boss.xpReward * 0.3));
  }
  
  // Add battle summary
  const logSample = battleLog.slice(-6).join('\n');
  resultEmbed.addFields({
    name: '📜 Battle Summary',
    value: logSample,
    inline: false
  });
  
  // Boss-specific Plagg commentary
  let plaggComment = '';
  switch (boss.id) {
    case 'cheese_king':
      plaggComment = playerHP > 0 ? 
        'You defeated my cousin! I\'m both proud and slightly concerned about family dinner...' :
        'Even I couldn\'t beat the Cheese King. You did well to last that long!';
      break;
    case 'shadow_lord':
      plaggComment = playerHP > 0 ?
        'You saved all of cheesedom! The dairy industry owes you a lifetime supply of camembert!' :
        'The Shadow Lord\'s darkness is strong. But cheese will always triumph in the end!';
      break;
    case 'dragon_gruyere':
      plaggComment = playerHP > 0 ?
        'INCREDIBLE! You\'ve defeated the ultimate cheese dragon! You are now worthy of the title: Master of Cheese!' :
        'Even legends fall sometimes. The dragon respects your courage!';
      break;
  }
  
  resultEmbed.addFields({
    name: '🧀 Plagg\'s Commentary',
    value: `*"${plaggComment}"*`,
    inline: false
  });
  
  await battleMessage.edit({ embeds: [resultEmbed] });
}

export default boss;
