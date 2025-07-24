import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'fortune',
    description: 'Get your daily fortune and predictions',
    usage: '$fortune [type]',
    category: 'fun',
    async execute(message, args) {
        const fortuneType = args[0]?.toLowerCase() || 'general';
        
        const fortunes = {
            general: [
                "Today brings new opportunities your way. Stay alert!",
                "A surprising encounter will brighten your day.",
                "Your creativity will solve an important problem today.",
                "Good fortune follows those who are patient.",
                "An unexpected message will bring good news.",
                "Your kindness will be returned tenfold today.",
                "A small risk today leads to great rewards tomorrow.",
                "Trust your instincts - they're especially sharp today.",
                "Someone you meet today will become important to your future.",
                "Your positive energy will attract wonderful things."
            ],
            love: [
                "Romance is in the air - keep your heart open.",
                "A meaningful conversation will deepen a relationship.",
                "Love finds you when you least expect it.",
                "An old friend may become something more.",
                "Your charm is especially magnetic today.",
                "A misunderstanding will be cleared up, bringing you closer.",
                "Someone special is thinking about you right now.",
                "True love requires patience - good things take time.",
                "A small gesture will mean more than grand displays.",
                "Your heart knows the answer - listen to it."
            ],
            wealth: [
                "A financial opportunity will present itself soon.",
                "Your hard work is about to pay off handsomely.",
                "An investment of time will yield unexpected returns.",
                "Generosity today brings abundance tomorrow.",
                "A forgotten asset will prove valuable.",
                "New income streams flow your way.",
                "Your talents are more valuable than you realize.",
                "Wise spending today prevents future regrets.",
                "A partnership will boost your financial prospects.",
                "Abundance comes to those who share freely."
            ],
            gaming: [
                "Your next RNG roll will be legendary!",
                "A rare drop awaits you in your adventures.",
                "Your gaming skills will carry you to victory today.",
                "A challenging boss will fall to your strategy.",
                "Your next loot box holds something special.",
                "An epic quest completion is in your near future.",
                "Your team will achieve perfect coordination.",
                "A speedrun personal best is within reach.",
                "Your next match will be your most satisfying yet.",
                "The game's RNG gods smile upon you today."
            ],
            plagg: [
                "Cheese will solve at least three of your problems today.",
                "A nap at the perfect time will give you great clarity.",
                "Your laziness today is actually strategic planning.",
                "Someone will offer you something deliciously tempting.",
                "Chaos today leads to perfect order tomorrow.",
                "Your sarcasm will be especially appreciated today.",
                "A shortcut will save you from unnecessary work.",
                "Your appetite for good things will be well-rewarded.",
                "Destruction of old habits makes room for better ones.",
                "Your carefree attitude will inspire someone important."
            ]
        };

        let selectedFortunes: string[];
        let fortuneName: string;
        let emoji: string;
        let color: number;

        if (fortuneType in fortunes) {
            selectedFortunes = fortunes[fortuneType as keyof typeof fortunes];
            fortuneName = fortuneType.charAt(0).toUpperCase() + fortuneType.slice(1);
            
            // Type-specific styling
            const typeData = {
                general: { emoji: '🔮', color: 0x8b4513 },
                love: { emoji: '💖', color: 0xff69b4 },
                wealth: { emoji: '💰', color: 0xffd700 },
                gaming: { emoji: '🎮', color: 0x00ff00 },
                plagg: { emoji: '🧀', color: 0x000000 }
            };
            
            const data = typeData[fortuneType as keyof typeof typeData] || typeData.general;
            emoji = data.emoji;
            color = data.color;
        } else {
            // Show available types
            const embed = new EmbedBuilder()
                .setTitle('🔮 Fortune Types')
                .setDescription('Choose your fortune category:')
                .addFields(
                    { name: '✨ Available Types', value: '• `general` - Overall life guidance 🔮\n• `love` - Romance and relationships 💖\n• `wealth` - Money and prosperity 💰\n• `gaming` - Gaming luck and success 🎮\n• `plagg` - Cheese-themed wisdom 🧀', inline: false },
                    { name: '📝 Usage', value: '`$fortune [type]`\nExample: `$fortune love`', inline: false }
                )
                .setColor(0x8b4513);

            return message.reply({ embeds: [embed] });
        }

        const randomFortune = selectedFortunes[Math.floor(Math.random() * selectedFortunes.length)];
        
        // Generate some additional mystical elements
        const luckyNumbers = Array.from({length: 3}, () => Math.floor(Math.random() * 100) + 1);
        const luckyColors = ['Red', 'Blue', 'Green', 'Purple', 'Gold', 'Silver', 'Orange', 'Pink'];
        const luckyColor = luckyColors[Math.floor(Math.random() * luckyColors.length)];
        
        // Moon phases for extra mysticism
        const moonPhases = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
        const currentMoon = moonPhases[Math.floor(Math.random() * moonPhases.length)];

        const embed = new EmbedBuilder()
            .setTitle(`${emoji} ${fortuneName} Fortune`)
            .setDescription(`*The cosmic forces reveal your destiny...*`)
            .addFields(
                { name: '🔮 Your Fortune', value: `"${randomFortune}"`, inline: false },
                { name: '🎲 Lucky Numbers', value: luckyNumbers.join(', '), inline: true },
                { name: '🌈 Lucky Color', value: luckyColor, inline: true },
                { name: '🌙 Moon Phase', value: currentMoon, inline: true }
            )
            .setColor(color)
            .setFooter({ 
                text: `Fortune told for ${message.author.username} • Fortunes update daily`,
                iconURL: message.author.displayAvatarURL()
            })
            .setTimestamp();

        // Add special messages for certain fortune types
        if (fortuneType === 'plagg') {
            embed.addFields({
                name: '🧀 Cheese Wisdom',
                value: '*"Remember, when in doubt, add more cheese!" - Ancient Kwami Proverb*',
                inline: false
            });
        } else if (fortuneType === 'gaming') {
            embed.addFields({
                name: '🎮 Gamer\'s Blessing',
                value: '*May your framerates be high and your ping be low!*',
                inline: false
            });
        }

        const reply = await message.reply({ embeds: [embed] });
        await reply.react(emoji);
    }
};

export default command;
