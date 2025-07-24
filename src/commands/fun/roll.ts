import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'roll',
    description: 'Roll dice with various configurations',
    usage: '$roll [dice] (e.g., 1d6, 2d20, 3d10+5)',
    category: 'fun',
    async execute(message, args) {
        let diceString = args.join('') || '1d6';
        
        // Parse the dice string (e.g., "2d20+5" or "1d6")
        const diceRegex = /^(\d+)?d(\d+)([\+\-]\d+)?$/i;
        const match = diceString.match(diceRegex);
        
        if (!match) {
            return message.reply('❌ Invalid dice format! Use format like: `1d6`, `2d20`, `3d10+5`, `1d20-2`');
        }

        const numDice = parseInt(match[1]) || 1;
        const diceSides = parseInt(match[2]);
        const modifier = match[3] ? parseInt(match[3]) : 0;

        // Validation
        if (numDice < 1 || numDice > 20) {
            return message.reply('❌ Number of dice must be between 1 and 20!');
        }
        
        if (diceSides < 2 || diceSides > 1000) {
            return message.reply('❌ Dice sides must be between 2 and 1000!');
        }

        // Roll the dice
        const rolls: number[] = [];
        for (let i = 0; i < numDice; i++) {
            rolls.push(Math.floor(Math.random() * diceSides) + 1);
        }

        const sum = rolls.reduce((a, b) => a + b, 0);
        const total = sum + modifier;

        // Determine result quality for color
        const maxPossible = numDice * diceSides + modifier;
        const percentage = (total / maxPossible) * 100;
        
        let color = 0x808080; // Gray
        let qualityText = '';
        
        if (percentage >= 90) {
            color = 0xffd700; // Gold
            qualityText = '🌟 Amazing!';
        } else if (percentage >= 70) {
            color = 0x00ff00; // Green
            qualityText = '✨ Great!';
        } else if (percentage >= 50) {
            color = 0xffff00; // Yellow
            qualityText = '👍 Good';
        } else if (percentage >= 30) {
            color = 0xff8000; // Orange
            qualityText = '😐 Okay';
        } else {
            color = 0xff0000; // Red
            qualityText = '😬 Ouch!';
        }

        const embed = new EmbedBuilder()
            .setTitle('🎲 Dice Roll Result')
            .addFields(
                { name: '🎯 Roll Command', value: `\`${diceString}\``, inline: true },
                { name: '🎲 Individual Rolls', value: rolls.join(', '), inline: true },
                { name: '📊 Sum', value: `${sum}`, inline: true }
            )
            .setColor(color);

        if (modifier !== 0) {
            embed.addFields(
                { name: '➕ Modifier', value: `${modifier > 0 ? '+' : ''}${modifier}`, inline: true },
                { name: '🎯 Final Total', value: `**${total}**`, inline: true },
                { name: '📈 Quality', value: qualityText, inline: true }
            );
        } else {
            embed.addFields(
                { name: '🎯 Total', value: `**${total}**`, inline: true },
                { name: '📈 Quality', value: qualityText, inline: true }
            );
        }

        // Add special messages for critical results
        if (numDice === 1) {
            if (rolls[0] === diceSides) {
                embed.setDescription('🔥 **CRITICAL SUCCESS!** Maximum roll achieved!');
            } else if (rolls[0] === 1) {
                embed.setDescription('💀 **CRITICAL FAILURE!** Minimum roll... ouch!');
            }
        }

        embed.setFooter({ 
            text: `Rolled by ${message.author.username}`,
            iconURL: message.author.displayAvatarURL()
        });

        await message.reply({ embeds: [embed] });
    }
};

export default command;
