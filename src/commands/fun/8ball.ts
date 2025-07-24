import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: '8ball',
    description: 'Ask the magic 8-ball a question',
    usage: '$8ball <question>',
    category: 'fun',
    async execute(message, args) {
        if (args.length === 0) {
            return message.reply('❌ You need to ask the magic 8-ball a question!');
        }

        const question = args.join(' ');
        
        if (question.length > 200) {
            return message.reply('❌ That question is too long! Keep it under 200 characters.');
        }

        const responses = [
            // Positive responses
            { text: 'It is certain', type: 'positive' },
            { text: 'It is decidedly so', type: 'positive' },
            { text: 'Without a doubt', type: 'positive' },
            { text: 'Yes definitely', type: 'positive' },
            { text: 'You may rely on it', type: 'positive' },
            { text: 'As I see it, yes', type: 'positive' },
            { text: 'Most likely', type: 'positive' },
            { text: 'Outlook good', type: 'positive' },
            { text: 'Yes', type: 'positive' },
            { text: 'Signs point to yes', type: 'positive' },
            
            // Neutral/uncertain responses
            { text: 'Reply hazy, try again', type: 'neutral' },
            { text: 'Ask again later', type: 'neutral' },
            { text: 'Better not tell you now', type: 'neutral' },
            { text: 'Cannot predict now', type: 'neutral' },
            { text: 'Concentrate and ask again', type: 'neutral' },
            
            // Negative responses
            { text: 'Don\'t count on it', type: 'negative' },
            { text: 'My reply is no', type: 'negative' },
            { text: 'My sources say no', type: 'negative' },
            { text: 'Outlook not so good', type: 'negative' },
            { text: 'Very doubtful', type: 'negative' },
            
            // Fun/custom responses
            { text: 'The cheese spirits say yes!', type: 'positive' },
            { text: 'Even Plagg doesn\'t know that one', type: 'neutral' },
            { text: 'Ask me after I finish my cheese', type: 'neutral' },
            { text: 'That\'s more confusing than quantum physics', type: 'neutral' },
            { text: 'The universe is too chaotic to tell', type: 'negative' }
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];
        
        let color: number;
        let emoji: string;
        
        switch (response.type) {
            case 'positive':
                color = 0x00ff00;
                emoji = '✅';
                break;
            case 'negative':
                color = 0xff0000;
                emoji = '❌';
                break;
            default:
                color = 0xffff00;
                emoji = '❓';
                break;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎱 Magic 8-Ball')
            .addFields(
                { name: '❓ Your Question', value: question, inline: false },
                { name: '🔮 The 8-Ball Says...', value: `${emoji} **${response.text}**`, inline: false }
            )
            .setColor(color)
            .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png') // 8-ball emoji
            .setFooter({ 
                text: `Asked by ${message.author.username}`,
                iconURL: message.author.displayAvatarURL()
            });

        // Add some mystical flavor text
        const flavorTexts = [
            '*The 8-ball swirls with mystical energy...*',
            '*Ancient wisdom flows through the sphere...*',
            '*The cosmic forces align to answer...*',
            '*Magic crackles as the answer appears...*',
            '*The universe whispers its secrets...*'
        ];
        
        const flavorText = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];
        embed.setDescription(flavorText);

        const reply = await message.reply({ embeds: [embed] });
        await reply.react('🎱');
    }
};

export default command;
