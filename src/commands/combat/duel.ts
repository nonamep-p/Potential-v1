import { Message } from 'discord.js';
import { Command } from '../../types.js';
import { DatabaseHelpers } from '../../utils/database.js';
import { GameEmbedBuilder } from '../../utils/embedBuilder.js';
import { CombatManager } from '../../structures/CombatManager.js';
import { prisma } from '../../index.js';

const duel: Command = {
  name: 'duel',
  description: 'Challenge another player to a PvP duel',
  category: 'combat',
  cooldown: 30,
  
  async execute(message: Message, args: string[]) {
    try {
      const challenger = await DatabaseHelpers.getPlayer(message.author.id);
      
      // Check if user mentioned someone
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        const embed = GameEmbedBuilder.createWarningEmbed(
          'You need to mention someone to duel! Example: `$duel @username`'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Can't duel yourself
      if (targetUser.id === message.author.id) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          'You cannot duel yourself! Find a worthy opponent.'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Can't duel bots
      if (targetUser.bot) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          'You cannot duel bots! Challenge a real player.'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Get target player
      const target = await DatabaseHelpers.getOrCreatePlayer(targetUser.id, targetUser.username);
      
      // Check level requirements
      const minLevel = 5;
      if (challenger.level < minLevel || target.level < minLevel) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          `Both players must be level ${minLevel} or higher to duel!`
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Check health
      if (challenger.health < challenger.maxHealth * 0.5) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          'You need at least 50% HP to duel! Rest or use healing items first.'
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      if (target.health < target.maxHealth * 0.5) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          `${target.username} needs at least 50% HP to duel!`
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Calculate wager (10% of lower player's gold, minimum 50)
      const wager = Math.max(50, Math.floor(Math.min(challenger.gold, target.gold) * 0.1));
      
      // Check if both players can afford wager
      if (challenger.gold < wager || target.gold < wager) {
        const embed = GameEmbedBuilder.createErrorEmbed(
          `Both players need at least ${wager} 🪙 to duel!`
        );
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Create duel challenge embed
      const challengeEmbed = GameEmbedBuilder.createGameEmbed(
        '⚔️ Duel Challenge!',
        `${challenger.username} challenges ${target.username} to a duel!`,
        0xDC2626
      );
      
      challengeEmbed.addFields(
        {
          name: '💰 Stakes',
          value: `**Wager:** ${wager} 🪙\n**Winner takes all!**`,
          inline: true
        },
        {
          name: '📊 Stats Comparison',
          value: `**${challenger.username}**\nLevel ${challenger.level} | ${challenger.elo} ELO\n\n**${target.username}**\nLevel ${target.level} | ${target.elo} ELO`,
          inline: true
        }
      );
      
      challengeEmbed.addFields({
        name: '⏰ Challenge Expires',
        value: `${targetUser} has 60 seconds to accept!\nReact with ⚔️ to accept or ❌ to decline`,
        inline: false
      });
      
      const challengeMessage = await message.reply({ embeds: [challengeEmbed] });
      
      // Add reactions
      await challengeMessage.react('⚔️');
      await challengeMessage.react('❌');
      
      // Wait for response
      const filter = (reaction: any, user: any) => {
        return ['⚔️', '❌'].includes(reaction.emoji.name) && user.id === targetUser.id;
      };
      
      try {
        const collected = await challengeMessage.awaitReactions({
          filter,
          max: 1,
          time: 60000,
          errors: ['time']
        });
        
        const reaction = collected.first();
        
        if (reaction?.emoji.name === '❌') {
          const declineEmbed = GameEmbedBuilder.createWarningEmbed(
            `${target.username} declined the duel challenge.`
          );
          await challengeMessage.edit({ embeds: [declineEmbed] });
          return;
        }
        
        if (reaction?.emoji.name === '⚔️') {
          // Start the duel!
          await startDuel(message, challenger, target, wager);
        }
        
      } catch (error) {
        const timeoutEmbed = GameEmbedBuilder.createWarningEmbed(
          `Duel challenge timed out. ${target.username} did not respond.`
        );
        await challengeMessage.edit({ embeds: [timeoutEmbed] });
      }
      
    } catch (error) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        error instanceof Error ? error.message : 'Failed to initiate duel'
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  }
};

async function startDuel(message: Message, challenger: any, target: any, wager: number) {
  const combatManager = new CombatManager(prisma);
  
  // Get combat stats for both players
  const challengerStats = await combatManager.getPlayerCombatStats(challenger);
  const targetStats = await combatManager.getPlayerCombatStats(target);
  
  // Simulate the duel (simplified PvP combat)
  let challengerHP = challengerStats.health;
  let targetHP = targetStats.health;
  let turn = 1;
  const maxTurns = 20; // Prevent infinite duels
  
  const battleLog: string[] = [];
  
  while (challengerHP > 0 && targetHP > 0 && turn <= maxTurns) {
    // Alternating turns based on agility
    const challengerFirst = challengerStats.agility >= targetStats.agility;
    
    if ((turn % 2 === 1 && challengerFirst) || (turn % 2 === 0 && !challengerFirst)) {
      // Challenger attacks
      const damage = Math.floor(
        ((challengerStats.strength * 0.5) + (challengerStats.weaponAttack || 0)) *
        (100 / (100 + targetStats.defense)) *
        (0.9 + Math.random() * 0.2)
      );
      targetHP -= damage;
      battleLog.push(`⚔️ ${challenger.username} attacks for ${damage} damage!`);
    } else {
      // Target attacks
      const damage = Math.floor(
        ((targetStats.strength * 0.5) + (targetStats.weaponAttack || 0)) *
        (100 / (100 + challengerStats.defense)) *
        (0.9 + Math.random() * 0.2)
      );
      challengerHP -= damage;
      battleLog.push(`⚔️ ${target.username} attacks for ${damage} damage!`);
    }
    
    turn++;
  }
  
  // Determine winner
  let winner, loser, winnerHP, loserHP;
  if (challengerHP <= 0 && targetHP <= 0) {
    // Draw - no winner
    const drawEmbed = GameEmbedBuilder.createGameEmbed(
      '🤝 Duel Draw!',
      'Both fighters collapsed at the same time! No one wins the wager.',
      0x6B7280
    );
    
    drawEmbed.addFields({
      name: '⚔️ Final Results',
      value: `**${challenger.username}:** ${challengerHP} HP\n**${target.username}:** ${targetHP} HP`,
      inline: true
    });
    
    await message.followUp({ embeds: [drawEmbed] });
    return;
  } else if (challengerHP > 0) {
    winner = challenger;
    loser = target;
    winnerHP = challengerHP;
    loserHP = targetHP;
  } else {
    winner = target;
    loser = challenger;
    winnerHP = targetHP;
    loserHP = challengerHP;
  }
  
  // Transfer gold and update ELO
  const eloChange = calculateEloChange(winner.elo, loser.elo);
  
  await DatabaseHelpers.updatePlayerStats(winner.discordId, {
    gold: { increment: wager },
    elo: { increment: eloChange },
    health: Math.max(1, winnerHP)
  });
  
  await DatabaseHelpers.updatePlayerStats(loser.discordId, {
    gold: { decrement: wager },
    elo: { decrement: eloChange },
    health: 1 // Loser gets 1 HP
  });
  
  // Create victory embed
  const victoryEmbed = GameEmbedBuilder.createGameEmbed(
    '🏆 Duel Victory!',
    `${winner.username} emerges victorious!`,
    0x10B981
  );
  
  victoryEmbed.addFields(
    {
      name: '⚔️ Final Results',
      value: `**${winner.username}:** ${winnerHP} HP (Winner)\n**${loser.username}:** ${loserHP} HP (Defeated)`,
      inline: true
    },
    {
      name: '💰 Rewards',
      value: `**${winner.username}** gains:\n• ${wager} 🪙\n• +${eloChange} ELO\n\n**${loser.username}** loses:\n• ${wager} 🪙\n• -${eloChange} ELO`,
      inline: true
    }
  );
  
  // Show some battle log
  if (battleLog.length > 0) {
    const logSample = battleLog.slice(-4).join('\n');
    victoryEmbed.addFields({
      name: '📜 Battle Summary',
      value: logSample,
      inline: false
    });
  }
  
  victoryEmbed.addFields({
    name: '🧀 Plagg\'s Commentary',
    value: `*"A decent fight, but it would've been more exciting with some cheese involved. Perhaps some weaponized brie next time?"*`,
    inline: false
  });
  
  await message.followUp({ embeds: [victoryEmbed] });
}

function calculateEloChange(winnerElo: number, loserElo: number): number {
  const K = 32; // K-factor
  const expectedWin = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return Math.round(K * (1 - expectedWin));
}

export default duel;
