import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getAllPlayers } from '../../utils/database.js';
import { formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'leaderboard',
    description: 'View various player rankings and leaderboards',
    usage: '$leaderboard [category]',
    category: 'social',
    async execute(message, args) {
        const category = args[0]?.toLowerCase() || 'level';
        
        const validCategories = ['level', 'gold', 'elo', 'xp'];
        
        if (!validCategories.includes(category)) {
            await showLeaderboardMenu(message);
            return;
        }

        await showLeaderboard(message, category);
    }
};

async function showLeaderboardMenu(message: any) {
    const embed = new EmbedBuilder()
        .setTitle('🏆 Leaderboard Categories')
        .setDescription('Choose which leaderboard you want to view:')
        .addFields(
            { name: '⭐ Level', value: 'Top players by character level', inline: true },
            { name: '💰 Gold', value: 'Richest players by gold amount', inline: true },
            { name: '🏟️ ELO', value: 'Best PvP fighters by ELO rating', inline: true },
            { name: '📊 XP', value: 'Most experienced players by total XP', inline: true }
        )
        .setColor(0x8b4513)
        .setFooter({ text: 'Use $leaderboard <category> or click a button below' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('lb_level')
                .setLabel('⭐ Level')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('lb_gold')
                .setLabel('💰 Gold')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('lb_elo')
                .setLabel('🏟️ ELO')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('lb_xp')
                .setLabel('📊 XP')
                .setStyle(ButtonStyle.Secondary)
        );

    const response = await message.reply({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 60000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        
        const category = interaction.customId.replace('lb_', '');
        await showLeaderboard(response, category);
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function showLeaderboard(message: any, category: string) {
    try {
        const allPlayers = await getAllPlayers();
        
        if (allPlayers.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('🏆 Leaderboard')
                .setDescription('No players found! Be the first to start your RPG journey with `$startrpg`!')
                .setColor(0x8b4513);
            
            await message.edit({ embeds: [embed], components: [] });
            return;
        }

        // Sort players based on category
        let sortedPlayers;
        let categoryName: string;
        let categoryEmoji: string;
        let valueFormatter: (value: number) => string = (v) => v.toString();

        switch (category) {
            case 'level':
                sortedPlayers = allPlayers.sort((a, b) => b.level - a.level);
                categoryName = 'Level';
                categoryEmoji = '⭐';
                break;
            case 'gold':
                sortedPlayers = allPlayers.sort((a, b) => b.gold - a.gold);
                categoryName = 'Gold';
                categoryEmoji = '💰';
                valueFormatter = formatNumber;
                break;
            case 'elo':
                sortedPlayers = allPlayers.sort((a, b) => b.elo - a.elo);
                categoryName = 'ELO Rating';
                categoryEmoji = '🏟️';
                valueFormatter = formatNumber;
                break;
            case 'xp':
                sortedPlayers = allPlayers.sort((a, b) => b.xp - a.xp);
                categoryName = 'Experience Points';
                categoryEmoji = '📊';
                valueFormatter = formatNumber;
                break;
            default:
                sortedPlayers = allPlayers.sort((a, b) => b.level - a.level);
                categoryName = 'Level';
                categoryEmoji = '⭐';
                break;
        }

        const topPlayers = sortedPlayers.slice(0, 10);
        const userRank = sortedPlayers.findIndex(p => p.discordId === message.author?.id) + 1;
        
        let leaderboardText = '';
        for (let i = 0; i < topPlayers.length; i++) {
            const player = topPlayers[i];
            const position = i + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
            
            let value: number;
            switch (category) {
                case 'level':
                    value = player.level;
                    break;
                case 'gold':
                    value = player.gold;
                    break;
                case 'elo':
                    value = player.elo;
                    break;
                case 'xp':
                    value = player.xp;
                    break;
                default:
                    value = player.level;
                    break;
            }
            
            leaderboardText += `${medal} **${player.username}** - ${valueFormatter(value)}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${categoryEmoji} ${categoryName} Leaderboard`)
            .setDescription(leaderboardText)
            .setColor(0xffd700)
            .addFields(
                { name: '📊 Total Players', value: `${allPlayers.length}`, inline: true },
                { name: '👤 Your Rank', value: userRank > 0 ? `#${userRank}` : 'Not Ranked', inline: true },
                { name: '🎯 Top Player', value: topPlayers.length > 0 ? topPlayers[0].username : 'None', inline: true }
            )
            .setFooter({ text: 'Rankings update in real-time!' })
            .setTimestamp();

        // Navigation buttons
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lb_level')
                    .setLabel('⭐ Level')
                    .setStyle(category === 'level' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(category === 'level'),
                new ButtonBuilder()
                    .setCustomId('lb_gold')
                    .setLabel('💰 Gold')
                    .setStyle(category === 'gold' ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setDisabled(category === 'gold'),
                new ButtonBuilder()
                    .setCustomId('lb_elo')
                    .setLabel('🏟️ ELO')
                    .setStyle(category === 'elo' ? ButtonStyle.Danger : ButtonStyle.Secondary)
                    .setDisabled(category === 'elo'),
                new ButtonBuilder()
                    .setCustomId('lb_xp')
                    .setLabel('📊 XP')
                    .setStyle(category === 'xp' ? ButtonStyle.Secondary : ButtonStyle.Secondary)
                    .setDisabled(category === 'xp')
            );

        await message.edit({ embeds: [embed], components: [row] });

        // Set up collector for navigation
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i: any) => i.user.id === message.author?.id,
            time: 60000
        });

        collector.on('collect', async (interaction: any) => {
            await interaction.deferUpdate();
            
            const newCategory = interaction.customId.replace('lb_', '');
            await showLeaderboard(message, newCategory);
        });

        collector.on('end', () => {
            message.edit({ components: [] });
        });

    } catch (error) {
        console.error('Leaderboard error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Leaderboard Error')
            .setDescription('Failed to load leaderboard data. Please try again later.')
            .setColor(0xff0000);
        
        await message.edit({ embeds: [errorEmbed], components: [] });
    }
}

export default command;
