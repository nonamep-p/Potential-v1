import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'quote',
    description: 'Get an inspirational or funny quote',
    usage: '$quote [category]',
    category: 'fun',
    async execute(message, args) {
        const category = args[0]?.toLowerCase() || 'random';
        
        const quotes = {
            inspirational: [
                { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
                { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
                { text: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
                { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
                { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
                { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
                { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
                { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" }
            ],
            gaming: [
                { text: "A hero need not speak. When he is gone, the world will speak for him.", author: "Halo 3" },
                { text: "The numbers, Mason, what do they mean?", author: "Call of Duty: Black Ops" },
                { text: "War. War never changes.", author: "Fallout" },
                { text: "It's dangerous to go alone! Take this.", author: "The Legend of Zelda" },
                { text: "Would you kindly?", author: "BioShock" },
                { text: "A man chooses, a slave obeys.", author: "BioShock" },
                { text: "The cake is a lie.", author: "Portal" },
                { text: "Stay awhile and listen.", author: "Diablo" }
            ],
            funny: [
                { text: "I haven't failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
                { text: "I'm not lazy, I'm just very relaxed.", author: "Unknown" },
                { text: "I told my wife she was drawing her eyebrows too high. She looked surprised.", author: "Unknown" },
                { text: "The trouble with having an open mind is that people keep coming along and sticking things into it.", author: "Terry Pratchett" },
                { text: "Time flies like an arrow; fruit flies like a banana.", author: "Groucho Marx" },
                { text: "I can resist everything except temptation.", author: "Oscar Wilde" },
                { text: "Common sense is not so common.", author: "Voltaire" },
                { text: "If at first you don't succeed, then skydiving definitely isn't for you.", author: "Steven Wright" }
            ],
            plagg: [
                { text: "Cheese is the answer to everything. If cheese isn't the answer, you're asking the wrong question.", author: "Plagg" },
                { text: "Why do anything when you can just sleep and eat cheese?", author: "Plagg" },
                { text: "Destruction is easy. Not destroying things when you're hungry is hard.", author: "Plagg" },
                { text: "I'm not lazy, I'm conserving energy for important cheese-related activities.", author: "Plagg" },
                { text: "Life is like cheese - it gets better with age, but sometimes it just gets moldy.", author: "Plagg" },
                { text: "If you can't solve it with cheese, you're not using enough cheese.", author: "Plagg" },
                { text: "Sleep is just practice for being unconscious. Very important skill.", author: "Plagg" },
                { text: "Chaos is just order that hasn't had enough cheese yet.", author: "Plagg" }
            ]
        };

        let selectedQuotes: Array<{ text: string; author: string }>;
        let categoryName: string;

        if (category === 'random') {
            const allQuotes = [...quotes.inspirational, ...quotes.gaming, ...quotes.funny, ...quotes.plagg];
            selectedQuotes = allQuotes;
            categoryName = 'Random';
        } else if (category in quotes) {
            selectedQuotes = quotes[category as keyof typeof quotes];
            categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        } else {
            // Invalid category, show available categories
            const embed = new EmbedBuilder()
                .setTitle('💬 Quote Categories')
                .setDescription('Choose from these quote categories:')
                .addFields(
                    { name: '✨ Available Categories', value: '• `inspirational` - Motivational quotes\n• `gaming` - Famous gaming quotes\n• `funny` - Humorous quotes\n• `plagg` - Cheese-themed wisdom\n• `random` - Mix of all categories', inline: false },
                    { name: '📝 Usage', value: '`$quote [category]`\nExample: `$quote gaming`', inline: false }
                )
                .setColor(0x8b4513);

            return message.reply({ embeds: [embed] });
        }

        const randomQuote = selectedQuotes[Math.floor(Math.random() * selectedQuotes.length)];

        // Choose color based on category
        let color: number;
        let emoji: string;
        
        switch (category) {
            case 'inspirational':
                color = 0xffd700;
                emoji = '✨';
                break;
            case 'gaming':
                color = 0x00ff00;
                emoji = '🎮';
                break;
            case 'funny':
                color = 0xff69b4;
                emoji = '😂';
                break;
            case 'plagg':
                color = 0x000000;
                emoji = '🧀';
                break;
            default:
                color = 0x8b4513;
                emoji = '💬';
                break;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${emoji} ${categoryName} Quote`)
            .setDescription(`*"${randomQuote.text}"*`)
            .addFields({
                name: '👤 Author',
                value: `— ${randomQuote.author}`,
                inline: false
            })
            .setColor(color)
            .setFooter({ 
                text: `Requested by ${message.author.username}`,
                iconURL: message.author.displayAvatarURL()
            });

        const reply = await message.reply({ embeds: [embed] });
        
        // Add reaction based on category
        const reactions = {
            inspirational: '💫',
            gaming: '🎮',
            funny: '😂',
            plagg: '🧀',
            random: '💬'
        };
        
        await reply.react(reactions[category as keyof typeof reactions] || '💬');
    }
};

export default command;
