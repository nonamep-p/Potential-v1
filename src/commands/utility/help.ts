import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { commandHandler } from '../../handlers/commandHandler.js';
import { config } from '../../config.js';

const command: Command = {
    name: 'help',
    description: 'Show help information and command list',
    usage: '$help [command_name]',
    category: 'utility',
    async execute(message, args) {
        if (args.length > 0) {
            await showSpecificHelp(message, args[0].toLowerCase());
        } else {
            await showGeneralHelp(message);
        }
    }
};

async function showGeneralHelp(message: any) {
    const commands = Array.from(commandHandler.commands.values());
    const categories = [...new Set(commands.map(cmd => cmd.category))].sort();

    let currentPage = 0;

    const generateEmbed = (page: number) => {
        const category = categories[page];
        const categoryCommands = commands.filter(cmd => cmd.category === category);

        const embed = new EmbedBuilder()
            .setTitle('📚 Plagg Bot Help')
            .setDescription(`${getCategoryEmoji(category)} **${category.toUpperCase()}** Commands`)
            .setColor(0x8b4513)
            .setThumbnail(message.client.user.displayAvatarURL())
            .setFooter({ text: `Page ${page + 1}/${categories.length} | Use ${config.PREFIX}help <command> for details` });

        let commandList = '';
        for (const cmd of categoryCommands.slice(0, 15)) {
            commandList += `\`${config.PREFIX}${cmd.name}\` - ${cmd.description}\n`;
        }

        embed.addFields({
            name: `Commands (${categoryCommands.length})`,
            value: commandList || 'No commands in this category.',
            inline: false
        });

        // Add category-specific information
        embed.addFields(getCategoryInfo(category));

        return embed;
    };

    const generateButtons = (page: number) => {
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('help_prev')
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('help_next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === categories.length - 1),
                new ButtonBuilder()
                    .setCustomId('help_overview')
                    .setLabel('📋 Overview')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('help_close')
                    .setLabel('❌ Close')
                    .setStyle(ButtonStyle.Danger)
            );
    };

    const response = await message.reply({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)]
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 300000 // 5 minutes
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        switch (interaction.customId) {
            case 'help_prev':
                if (currentPage > 0) {
                    currentPage--;
                    await response.edit({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                }
                break;

            case 'help_next':
                if (currentPage < categories.length - 1) {
                    currentPage++;
                    await response.edit({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                }
                break;

            case 'help_overview':
                await showOverview(response);
                break;

            case 'help_close':
                const closeEmbed = new EmbedBuilder()
                    .setTitle('📚 Help Closed')
                    .setDescription('Thanks for using Plagg Bot! Need help again? Just use `$help`!')
                    .setColor(0x00ff00);
                
                await response.edit({ embeds: [closeEmbed], components: [] });
                break;
        }
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function showOverview(message: any) {
    const embed = new EmbedBuilder()
        .setTitle('🎮 Plagg Bot - Isekai RPG')
        .setDescription('Welcome to the ultimate Discord RPG experience!')
        .addFields(
            {
                name: '🚀 Getting Started',
                value: '• Use `$startrpg` to begin your adventure\n• Check `$profile` to view your character\n• Use `$help character` for character commands',
                inline: false
            },
            {
                name: '⚔️ Combat & Adventure',
                value: '• Fight monsters with `$battle`\n• Explore dungeons with `$dungeon`\n• Challenge players with `$duel`',
                inline: false
            },
            {
                name: '💰 Economy',
                value: '• Check balance with `$balance`\n• Buy items at `$shop`\n• Trade with players using `$market`',
                inline: false
            },
            {
                name: '🎯 Key Features',
                value: '• 50+ Interactive Commands\n• Turn-based Combat System\n• Character Progression\n• Player Marketplace\n• AI Chat with Plagg\n• Isekai Scenarios',
                inline: false
            },
            {
                name: '🔗 Quick Links',
                value: '• `$chat` - Talk with Plagg AI\n• `$daily` - Claim daily rewards\n• `$leaderboard` - View top players\n• `$ping` - Check bot status',
                inline: false
            }
        )
        .setColor(0x8b4513)
        .setThumbnail(message.client?.user?.displayAvatarURL())
        .setFooter({ text: 'Plagg Bot - Your gateway to adventure!' });

    await message.edit({ embeds: [embed], components: [] });
}

async function showSpecificHelp(message: any, commandName: string) {
    const command = commandHandler.commands.get(commandName);
    
    if (!command) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Command Not Found')
            .setDescription(`Command \`${commandName}\` doesn't exist!`)
            .addFields({
                name: '💡 Suggestion',
                value: `Use \`${config.PREFIX}help\` to see all available commands.`,
                inline: false
            })
            .setColor(0xff0000);

        return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
        .setTitle(`📖 Command: ${config.PREFIX}${command.name}`)
        .setDescription(command.description)
        .addFields(
            { name: '📝 Usage', value: `\`${command.usage}\``, inline: false },
            { name: '📂 Category', value: command.category, inline: true }
        )
        .setColor(0x8b4513);

    if (command.cooldown) {
        embed.addFields({
            name: '⏰ Cooldown',
            value: `${command.cooldown} seconds`,
            inline: true
        });
    }

    if (command.ownerOnly) {
        embed.addFields({
            name: '🔒 Permissions',
            value: 'Owner Only',
            inline: true
        });
    }

    // Add command-specific examples or additional info
    const examples = getCommandExamples(command.name);
    if (examples.length > 0) {
        embed.addFields({
            name: '💡 Examples',
            value: examples.join('\n'),
            inline: false
        });
    }

    await message.reply({ embeds: [embed] });
}

function getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
        'character': '👤',
        'combat': '⚔️',
        'dungeon': '🏰',
        'economy': '💰',
        'utility': '🔧',
        'fun': '🎮',
        'social': '👥',
        'items': '🎒',
        'isekai': '🌟',
        'admin': '👑'
    };
    return emojis[category] || '📁';
}

function getCategoryInfo(category: string): { name: string; value: string; inline: boolean } {
    const info: Record<string, { name: string; value: string; inline: boolean }> = {
        'character': {
            name: '📋 About Character Commands',
            value: 'Manage your RPG character, view stats, equipment, and progression.',
            inline: false
        },
        'combat': {
            name: '⚔️ About Combat Commands', 
            value: 'Engage in battles, duels, and arena fights with other players and monsters.',
            inline: false
        },
        'economy': {
            name: '💰 About Economy Commands',
            value: 'Manage your gold, trade items, work jobs, and participate in the marketplace.',
            inline: false
        },
        'dungeon': {
            name: '🏰 About Dungeon Commands',
            value: 'Explore dangerous dungeons, face powerful bosses, and discover treasures.',
            inline: false
        },
        'fun': {
            name: '🎮 About Fun Commands',
            value: 'Entertainment commands including AI chat, games, and random fun activities.',
            inline: false
        }
    };

    return info[category] || {
        name: '📖 About This Category',
        value: 'Various utility and feature commands.',
        inline: false
    };
}

function getCommandExamples(commandName: string): string[] {
    const examples: Record<string, string[]> = {
        'battle': ['`$battle` - Fight a random monster'],
        'shop': ['`$shop` - Browse all categories', '`$shop weapons` - Browse weapons only'],
        'market': ['`$market` - Browse player market', '`$market sell sword 1000` - Sell a sword for 1000 gold'],
        'work': ['`$work` - View available jobs', '`$work mining` - Work as a miner'],
        'gamble': ['`$gamble coinflip 100` - Bet 100 gold on coin flip', '`$gamble slots 50` - Play slots with 50 gold'],
        'trade': ['`$trade @username` - Start a trade with another player'],
        'duel': ['`$duel @username` - Challenge someone to a duel']
    };

    return examples[commandName] || [];
}

export default command;
