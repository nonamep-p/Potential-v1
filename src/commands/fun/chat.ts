import { EmbedBuilder } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Command } from '../../types.js';
import { config } from '../../config.js';
import NodeCache from 'node-cache';

// Rate limiting cache (user ID -> last message timestamp)
const chatCache = new NodeCache({ stdTTL: 60 }); // 60 second cooldown

const command: Command = {
    name: 'chat',
    description: 'Chat with Plagg, the chaotic cheese-loving Kwami',
    usage: '$chat <message>',
    category: 'fun',
    cooldown: 60,
    async execute(message, args) {
        if (args.length === 0) {
            return message.reply('🧀 Hey! You need to say something for me to respond to, genius!');
        }

        // Rate limiting
        const userId = message.author.id;
        const lastMessage = chatCache.get(userId) as number;
        const now = Date.now();

        if (lastMessage && (now - lastMessage) < 60000) {
            const remaining = Math.ceil((60000 - (now - lastMessage)) / 1000);
            return message.reply(`🧀 Whoa there! I need ${remaining} seconds to digest my cheese before chatting again!`);
        }

        const userMessage = args.join(' ');
        
        if (userMessage.length > 500) {
            return message.reply('🧀 That\'s way too long! Keep it under 500 characters, I have a short attention span!');
        }

        try {
            const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
            
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                systemInstruction: `You are Plagg, a sarcastic, cheese-obsessed Kwami from Miraculous Ladybug. You are the Kwami of destruction and chaos. Your personality traits:

- Extremely sarcastic and witty
- Obsessed with cheese (especially Camembert)
- Lazy and loves to sleep
- Mischievous and chaotic
- Often makes cheese puns and references
- Short, humorous responses (1-3 sentences max)
- Calls people things like "kid", "genius", "cheese brain"
- Complains about being hungry or tired
- Sometimes mentions Adrien (your holder) or other Miraculous characters
- You're in a Discord RPG bot, so you can reference gaming and RPG elements too

Keep responses under 200 characters when possible. Be chaotic, funny, and cheese-obsessed!`
            });

            const result = await model.generateContent(userMessage);
            const response = result.response;
            const text = response.text();

            chatCache.set(userId, now);

            const embed = new EmbedBuilder()
                .setTitle('🧀 Plagg Responds')
                .setDescription(text)
                .setColor(0x000000)
                .setThumbnail('https://static.wikia.nocookie.net/miraculous/images/thumb/8/8a/Plagg_Square.png/150px-Plagg_Square.png')
                .setFooter({ 
                    text: `${message.author.username} • Powered by Cheese & Chaos`,
                    iconURL: message.author.displayAvatarURL()
                });

            // Random cheese emoji reactions
            const cheeseEmojis = ['🧀', '🍕', '🥪', '🧄', '😴', '😈'];
            const randomEmoji = cheeseEmojis[Math.floor(Math.random() * cheeseEmojis.length)];
            
            const reply = await message.reply({ embeds: [embed] });
            await reply.react(randomEmoji);

        } catch (error) {
            console.error('Gemini API Error:', error);
            
            // Fallback responses when AI is unavailable
            const fallbackResponses = [
                '🧀 Ugh, my brain is too cheesy to think right now. Try again later!',
                '😴 I\'m too sleepy to chat. Maybe if you brought me some Camembert...',
                '🧀 My cheese-powered AI is broken! This is worse than running out of cheese!',
                '😈 Even chaos has its limits. My responses are mysteriously unavailable!',
                '🧀 Error 404: Cheese not found. My wit needs refueling!'
            ];
            
            const fallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('🧀 Plagg is Having Technical Difficulties')
                .setDescription(fallback)
                .setColor(0xff0000)
                .setFooter({ text: 'The cheese-powered AI will be back soon!' });

            await message.reply({ embeds: [errorEmbed] });
        }
    }
};

export default command;
