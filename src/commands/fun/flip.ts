import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'flip',
    description: 'Flip a coin or make a choice between options',
    usage: '$flip [option1] [option2] [option3...]',
    category: 'fun',
    async execute(message, args) {
        if (args.length === 0) {
            // Simple coin flip
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            const emoji = result === 'Heads' ? '🪙' : '🟡';
            
            const embed = new EmbedBuilder()
                .setTitle('🪙 Coin Flip')
                .setDescription(`The coin landed on... **${result}**! ${emoji}`)
                .setColor(result === 'Heads' ? 0xffd700 : 0xc0c0c0)
                .setFooter({ 
                    text: `Flipped by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL()
                });

            await message.reply({ embeds: [embed] });
            
        } else if (args.length === 1) {
            // Single option doesn't make sense for choice
            return message.reply('❌ You need at least 2 options to choose from! Or use `$flip` with no arguments for a coin flip.');
            
        } else {
            // Choose between multiple options
            const options = args;
            const chosen = options[Math.floor(Math.random() * options.length)];
            
            // Create a fun description based on number of options
            let description = '';
            if (options.length === 2) {
                description = '🪙 Flipping a coin to decide...';
            } else if (options.length <= 5) {
                description = '🎲 Rolling the dice of fate...';
            } else {
                description = '🎰 Spinning the wheel of destiny...';
            }

            const embed = new EmbedBuilder()
                .setTitle('🎯 Choice Maker')
                .setDescription(description)
                .addFields(
                    { name: '📝 Options', value: options.map((opt, i) => `${i + 1}. ${opt}`).join('\n'), inline: false },
                    { name: '🏆 Winner', value: `**${chosen}**`, inline: false }
                )
                .setColor(0x8b4513)
                .setFooter({ 
                    text: `Decided for ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL()
                });

            // Add some fun reactions based on the result
            const reactions = ['🎉', '✨', '🎊', '🌟', '💫', '🎈'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            
            const reply = await message.reply({ embeds: [embed] });
            await reply.react(randomReaction);
        }
    }
};

export default command;
