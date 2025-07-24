import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'gamble',
    description: 'Try your luck at various gambling games',
    usage: '$gamble [game] [bet_amount]',
    category: 'economy',
    cooldown: 60,
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 5) {
            return message.reply('❌ You need to be level 5 or higher to gamble!');
        }

        if (player.gold < 10) {
            return message.reply('❌ You need at least 10 gold to gamble!');
        }

        const game = args[0]?.toLowerCase();
        const betAmount = parseInt(args[1]);

        if (!game) {
            await showGamblingMenu(message, player);
            return;
        }

        if (isNaN(betAmount) || betAmount <= 0) {
            return message.reply('❌ Please provide a valid bet amount!');
        }

        if (betAmount > player.gold) {
            return message.reply(`❌ You don't have enough gold! You only have ${formatNumber(player.gold)} gold.`);
        }

        const maxBet = Math.min(10000, player.gold);
        if (betAmount > maxBet) {
            return message.reply(`❌ Maximum bet is ${formatNumber(maxBet)} gold!`);
        }

        switch (game) {
            case 'coinflip':
            case 'flip':
                await playCoinFlip(message, player, betAmount);
                break;
            case 'dice':
            case 'roll':
                await playDiceRoll(message, player, betAmount);
                break;
            case 'slots':
            case 'slot':
                await playSlots(message, player, betAmount);
                break;
            case 'blackjack':
            case 'bj':
                await playBlackjack(message, player, betAmount);
                break;
            default:
                await showGamblingMenu(message, player);
                break;
        }
    }
};

async function showGamblingMenu(message: any, player: any) {
    const embed = new EmbedBuilder()
        .setTitle('🎰 Casino Games')
        .setDescription('Welcome to the casino! Choose your game:')
        .addFields(
            { name: '🪙 Coin Flip', value: 'Heads or tails? 50/50 chance\n**Payout:** 2x bet', inline: true },
            { name: '🎲 Dice Roll', value: 'Roll 6 or higher to win\n**Payout:** 2.4x bet', inline: true },
            { name: '🎰 Slots', value: 'Match symbols for big wins\n**Payout:** Up to 10x bet', inline: true },
            { name: '🃏 Blackjack', value: 'Get closer to 21 than dealer\n**Payout:** 2x bet', inline: true },
            { name: '💰 Your Gold', value: formatNumber(player.gold), inline: false },
            { name: '⚠️ Gambling Warning', value: 'Gambling can be addictive. Play responsibly!', inline: false }
        )
        .setColor(0x8b4513)
        .setFooter({ text: 'Usage: $gamble <game> <bet_amount>' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('gamble_coinflip')
                .setLabel('🪙 Coin Flip')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('gamble_dice')
                .setLabel('🎲 Dice Roll')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('gamble_slots')
                .setLabel('🎰 Slots')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('gamble_blackjack')
                .setLabel('🃏 Blackjack')
                .setStyle(ButtonStyle.Danger)
        );

    const response = await message.reply({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 60000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        
        const game = interaction.customId.replace('gamble_', '');
        await interaction.followUp({
            content: `🎰 To play ${game}, use: \`$gamble ${game} <bet_amount>\`\nExample: \`$gamble ${game} 100\``,
            ephemeral: true
        });
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function playCoinFlip(message: any, player: any, betAmount: number) {
    const playerChoice = Math.random() > 0.5 ? 'heads' : 'tails';
    const result = Math.random() > 0.5 ? 'heads' : 'tails';
    const won = playerChoice === result;

    const embed = new EmbedBuilder()
        .setTitle('🪙 Coin Flip Result')
        .setDescription(`The coin landed on **${result}**!`)
        .addFields(
            { name: '🎯 Your Choice', value: playerChoice, inline: true },
            { name: '🪙 Result', value: result, inline: true },
            { name: '💰 Bet Amount', value: formatNumber(betAmount), inline: true }
        )
        .setColor(won ? 0x00ff00 : 0xff0000);

    if (won) {
        const winnings = betAmount;
        await updatePlayer(player.discordId, {
            gold: player.gold + winnings
        });
        
        embed.addFields(
            { name: '🎉 Result', value: 'YOU WON!', inline: true },
            { name: '💎 Winnings', value: formatNumber(winnings), inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold + winnings), inline: true }
        );
    } else {
        await updatePlayer(player.discordId, {
            gold: player.gold - betAmount
        });
        
        embed.addFields(
            { name: '💀 Result', value: 'You Lost', inline: true },
            { name: '💸 Lost', value: formatNumber(betAmount), inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold - betAmount), inline: true }
        );
    }

    await message.reply({ embeds: [embed] });
}

async function playDiceRoll(message: any, player: any, betAmount: number) {
    const roll = Math.floor(Math.random() * 12) + 1; // 1-12
    const won = roll >= 6;

    const embed = new EmbedBuilder()
        .setTitle('🎲 Dice Roll Result')
        .setDescription(`You rolled a **${roll}**!`)
        .addFields(
            { name: '🎲 Your Roll', value: `${roll}`, inline: true },
            { name: '🎯 Target', value: '6 or higher', inline: true },
            { name: '💰 Bet Amount', value: formatNumber(betAmount), inline: true }
        )
        .setColor(won ? 0x00ff00 : 0xff0000);

    if (won) {
        const multiplier = roll >= 10 ? 3 : roll >= 8 ? 2.5 : 2;
        const winnings = Math.floor(betAmount * multiplier) - betAmount;
        
        await updatePlayer(player.discordId, {
            gold: player.gold + winnings
        });
        
        embed.addFields(
            { name: '🎉 Result', value: 'YOU WON!', inline: true },
            { name: '💎 Multiplier', value: `${multiplier}x`, inline: true },
            { name: '💎 Winnings', value: formatNumber(winnings), inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold + winnings), inline: true }
        );
    } else {
        await updatePlayer(player.discordId, {
            gold: player.gold - betAmount
        });
        
        embed.addFields(
            { name: '💀 Result', value: 'You Lost', inline: true },
            { name: '💸 Lost', value: formatNumber(betAmount), inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold - betAmount), inline: true }
        );
    }

    await message.reply({ embeds: [embed] });
}

async function playSlots(message: any, player: any, betAmount: number) {
    const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎'];
    const slot1 = symbols[Math.floor(Math.random() * symbols.length)];
    const slot2 = symbols[Math.floor(Math.random() * symbols.length)];
    const slot3 = symbols[Math.floor(Math.random() * symbols.length)];

    let multiplier = 0;
    let result = '';

    if (slot1 === slot2 && slot2 === slot3) {
        // Three of a kind
        if (slot1 === '💎') {
            multiplier = 10;
            result = 'JACKPOT! Triple Diamonds!';
        } else if (slot1 === '⭐') {
            multiplier = 7;
            result = 'AMAZING! Triple Stars!';
        } else {
            multiplier = 5;
            result = 'GREAT! Three of a kind!';
        }
    } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
        // Two of a kind
        multiplier = 2;
        result = 'Nice! Two of a kind!';
    } else {
        result = 'No match, better luck next time!';
    }

    const embed = new EmbedBuilder()
        .setTitle('🎰 Slot Machine')
        .setDescription(`${slot1} | ${slot2} | ${slot3}`)
        .addFields(
            { name: '🎰 Slots', value: `${slot1} ${slot2} ${slot3}`, inline: true },
            { name: '💰 Bet Amount', value: formatNumber(betAmount), inline: true }
        )
        .setColor(multiplier > 0 ? 0x00ff00 : 0xff0000);

    if (multiplier > 0) {
        const winnings = Math.floor(betAmount * multiplier) - betAmount;
        
        await updatePlayer(player.discordId, {
            gold: player.gold + winnings
        });
        
        embed.addFields(
            { name: '🎉 Result', value: result, inline: false },
            { name: '💎 Multiplier', value: `${multiplier}x`, inline: true },
            { name: '💎 Winnings', value: formatNumber(winnings), inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold + winnings), inline: true }
        );
    } else {
        await updatePlayer(player.discordId, {
            gold: player.gold - betAmount
        });
        
        embed.addFields(
            { name: '💀 Result', value: result, inline: false },
            { name: '💸 Lost', value: formatNumber(betAmount), inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold - betAmount), inline: true }
        );
    }

    await message.reply({ embeds: [embed] });
}

async function playBlackjack(message: any, player: any, betAmount: number) {
    // Simplified blackjack simulation
    const playerScore = Math.floor(Math.random() * 11) + 15; // 15-25
    const dealerScore = Math.floor(Math.random() * 11) + 15; // 15-25
    
    let result = '';
    let won = false;

    if (playerScore > 21) {
        result = `You busted with ${playerScore}!`;
        won = false;
    } else if (dealerScore > 21) {
        result = `Dealer busted with ${dealerScore}! You win!`;
        won = true;
    } else if (playerScore > dealerScore) {
        result = `You win ${playerScore} vs ${dealerScore}!`;
        won = true;
    } else if (playerScore === dealerScore) {
        result = `Push! Both had ${playerScore}.`;
        won = null; // Push
    } else {
        result = `Dealer wins ${dealerScore} vs ${playerScore}.`;
        won = false;
    }

    const embed = new EmbedBuilder()
        .setTitle('🃏 Blackjack Result')
        .setDescription(result)
        .addFields(
            { name: '🎯 Your Score', value: `${playerScore}`, inline: true },
            { name: '🤖 Dealer Score', value: `${dealerScore}`, inline: true },
            { name: '💰 Bet Amount', value: formatNumber(betAmount), inline: true }
        )
        .setColor(won === true ? 0x00ff00 : won === false ? 0xff0000 : 0xffff00);

    if (won === true) {
        const winnings = betAmount;
        await updatePlayer(player.discordId, {
            gold: player.gold + winnings
        });
        
        embed.addFields(
            { name: '🎉 Result', value: 'YOU WON!', inline: true },
            { name: '💎 Winnings', value: formatNumber(winnings), inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold + winnings), inline: true }
        );
    } else if (won === false) {
        await updatePlayer(player.discordId, {
            gold: player.gold - betAmount
        });
        
        embed.addFields(
            { name: '💀 Result', value: 'You Lost', inline: true },
            { name: '💸 Lost', value: formatNumber(betAmount), inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold - betAmount), inline: true }
        );
    } else {
        embed.addFields(
            { name: '🤝 Result', value: 'PUSH - Tie Game', inline: true },
            { name: '💵 Balance', value: formatNumber(player.gold), inline: true }
        );
    }

    await message.reply({ embeds: [embed] });
}

export default command;
