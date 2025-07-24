import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
    name: 'joke',
    description: 'Get a random joke to brighten your day',
    usage: '$joke [category]',
    category: 'fun',
    async execute(message, args) {
        const category = args[0]?.toLowerCase() || 'random';
        
        const jokes = {
            programming: [
                { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs!" },
                { setup: "How many programmers does it take to change a light bulb?", punchline: "None. That's a hardware problem." },
                { setup: "Why do Java developers wear glasses?", punchline: "Because they can't C#!" },
                { setup: "What's a programmer's favorite hangout place?", punchline: "Foo Bar!" },
                { setup: "Why did the programmer quit his job?", punchline: "He didn't get arrays!" },
                { setup: "How do you comfort a JavaScript bug?", punchline: "You console it!" }
            ],
            gaming: [
                { setup: "Why don't gamers ever get hungry?", punchline: "Because they always have snacks in their inventory!" },
                { setup: "What do you call a noob's favorite type of music?", punchline: "Ragequit!" },
                { setup: "Why did the gamer go to therapy?", punchline: "He had too many issues with his controller!" },
                { setup: "What's a speedrunner's favorite type of food?", punchline: "Fast food!" },
                { setup: "Why don't NPCs ever win arguments?", punchline: "They only have scripted responses!" },
                { setup: "What do you call a gaming console in winter?", punchline: "A PlayStation Brrr!" }
            ],
            cheese: [
                { setup: "What did the cheese say when it looked in the mirror?", punchline: "Looking gouda!" },
                { setup: "Why did the cheese go to therapy?", punchline: "It had too many holes in its life!" },
                { setup: "What do you call cheese that isn't yours?", punchline: "Nacho cheese!" },
                { setup: "Why don't cheeses ever get lonely?", punchline: "They always stick together!" },
                { setup: "What's a mouse's favorite type of music?", punchline: "R&Brie!" },
                { setup: "How do you handle dangerous cheese?", punchline: "Caerphilly!" }
            ],
            dad: [
                { setup: "I'm afraid for the calendar.", punchline: "Its days are numbered." },
                { setup: "My wife said I should do lunges to stay in shape.", punchline: "That would be a big step forward." },
                { setup: "Why don't scientists trust atoms?", punchline: "Because they make up everything!" },
                { setup: "Did you hear about the mathematician who's afraid of negative numbers?", punchline: "He'll stop at nothing to avoid them!" },
                { setup: "What do you call a fake noodle?", punchline: "An impasta!" },
                { setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up!" }
            ],
            discord: [
                { setup: "Why did the Discord user get kicked from the server?", punchline: "They kept pinging @everyone for no reason!" },
                { setup: "What's a moderator's favorite type of music?", punchline: "Ban-d music!" },
                { setup: "Why don't bots ever get tired?", punchline: "They always stay connected!" },
                { setup: "What do you call a Discord server with no members?", punchline: "A lonely channel!" },
                { setup: "Why did the emoji go to school?", punchline: "To become more expressive! 😄" },
                { setup: "What's the difference between Discord and a broken phone?", punchline: "Discord has better connections!" }
            ]
        };

        let selectedJokes: Array<{ setup: string; punchline: string }>;
        let categoryName: string;
        let emoji: string;

        if (category === 'random') {
            const allJokes = [...jokes.programming, ...jokes.gaming, ...jokes.cheese, ...jokes.dad, ...jokes.discord];
            selectedJokes = allJokes;
            categoryName = 'Random';
            emoji = '😂';
        } else if (category in jokes) {
            selectedJokes = jokes[category as keyof typeof jokes];
            categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            
            // Category-specific emojis
            const categoryEmojis = {
                programming: '💻',
                gaming: '🎮',
                cheese: '🧀',
                dad: '👨',
                discord: '💬'
            };
            emoji = categoryEmojis[category as keyof typeof categoryEmojis] || '😂';
        } else {
            // Show available categories
            const embed = new EmbedBuilder()
                .setTitle('😂 Joke Categories')
                .setDescription('Choose from these hilarious categories:')
                .addFields(
                    { name: '🎭 Available Categories', value: '• `programming` - Code humor 💻\n• `gaming` - Gamer jokes 🎮\n• `cheese` - Cheesy puns 🧀\n• `dad` - Classic dad jokes 👨\n• `discord` - Platform humor 💬\n• `random` - Mix of all 😂', inline: false },
                    { name: '📝 Usage', value: '`$joke [category]`\nExample: `$joke gaming`', inline: false }
                )
                .setColor(0xff69b4);

            return message.reply({ embeds: [embed] });
        }

        const randomJoke = selectedJokes[Math.floor(Math.random() * selectedJokes.length)];

        const embed = new EmbedBuilder()
            .setTitle(`${emoji} ${categoryName} Joke`)
            .addFields(
                { name: '🎭 Setup', value: randomJoke.setup, inline: false },
                { name: '😄 Punchline', value: randomJoke.punchline, inline: false }
            )
            .setColor(0xff69b4)
            .setFooter({ 
                text: `Joke requested by ${message.author.username}`,
                iconURL: message.author.displayAvatarURL()
            });

        // Add some random funny flavor
        const reactions = ['😂', '🤣', '😄', '😆', '😁', '🤪'];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];

        const reply = await message.reply({ embeds: [embed] });
        await reply.react(randomReaction);
    }
};

export default command;
