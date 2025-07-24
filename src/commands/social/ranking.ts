import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, getAllPlayers } from '../../utils/database.js';
import { formatNumber, calculateLevelFromXP } from '../../utils/helpers.js';

const command: Command = {
    name: 'ranking',
    description: 'Check your detailed ranking across all categories',
    usage: '$ranking [@user]',
    category: 'social',
    async execute(message, args) {
        const targetUser = message.mentions.users.first() || message.author;
        
        const player = await getPlayer(targetUser.id);
        if (!player) {
            const errorMsg = targetUser.id === message.author.id 
                ? 'You need to start your RPG journey first! Use `$startrpg` to begin.'
                : 'This user has not started their RPG journey yet.';
            return message.reply(`❌ ${errorMsg}`);
        }

        try {
            const allPlayers = await getAllPlayers();
            
            if (allPlayers.length === 0) {
                return message.reply('❌ No ranking data available!');
            }

            // Calculate rankings for different categories
            const levelRanking = allPlayers
                .sort((a, b) => b.level - a.level)
                .findIndex(p => p.discordId === targetUser.id) + 1;

            const goldRanking = allPlayers
                .sort((a, b) => b.gold - a.gold)
                .findIndex(p => p.discordId === targetUser.id) + 1;

            const eloRanking = allPlayers
                .sort((a, b) => b.elo - a.elo)
                .findIndex(p => p.discordId === targetUser.id) + 1;

            const xpRanking = allPlayers
                .sort((a, b) => b.xp - a.xp)
                .findIndex(p => p.discordId === targetUser.id) + 1;

            // Calculate percentiles
            const totalPlayers = allPlayers.length;
            const levelPercentile = Math.round((1 - (levelRanking - 1) / totalPlayers) * 100);
            const goldPercentile = Math.round((1 - (goldRanking - 1) / totalPlayers) * 100);
            const eloPercentile = Math.round((1 - (eloRanking - 1) / totalPlayers) * 100);
            const xpPercentile = Math.round((1 - (xpRanking - 1) / totalPlayers) * 100);

            // Calculate overall score (weighted average)
            const overallScore = Math.round(
                (levelPercentile * 0.3) + 
                (goldPercentile * 0.2) + 
                (eloPercentile * 0.3) + 
                (xpPercentile * 0.2)
            );

            // Determine rank tier
            let rankTier: string;
            let rankEmoji: string;
            let rankColor: number;

            if (overallScore >= 95) {
                rankTier = 'Legendary';
                rankEmoji = '🏆';
                rankColor = 0xffd700;
            } else if (overallScore >= 85) {
                rankTier = 'Mythic';
                rankEmoji = '💎';
                rankColor = 0xff69b4;
            } else if (overallScore >= 75) {
                rankTier = 'Epic';
                rankEmoji = '🟣';
                rankColor = 0x8b00ff;
            } else if (overallScore >= 60) {
                rankTier = 'Rare';
                rankEmoji = '🔵';
                rankColor = 0x0080ff;
            } else if (overallScore >= 40) {
                rankTier = 'Uncommon';
                rankEmoji = '🟢';
                rankColor = 0x00ff00;
            } else {
                rankTier = 'Common';
                rankEmoji = '⚪';
                rankColor = 0x808080;
            }

            const embed = new EmbedBuilder()
                .setTitle(`${rankEmoji} ${player.username}'s Ranking`)
                .setDescription(`Overall Rank Tier: **${rankTier}** (${overallScore}/100)`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '⭐ Level Ranking', 
                        value: `**#${levelRanking}** / ${totalPlayers}\n${levelPercentile}th percentile\nLevel ${player.level}`, 
                        inline: true 
                    },
                    { 
                        name: '💰 Wealth Ranking', 
                        value: `**#${goldRanking}** / ${totalPlayers}\n${goldPercentile}th percentile\n${formatNumber(player.gold)} gold`, 
                        inline: true 
                    },
                    { 
                        name: '🏟️ Combat Ranking', 
                        value: `**#${eloRanking}** / ${totalPlayers}\n${eloPercentile}th percentile\n${player.elo} ELO`, 
                        inline: true 
                    },
                    { 
                        name: '📊 Experience Ranking', 
                        value: `**#${xpRanking}** / ${totalPlayers}\n${xpPercentile}th percentile\n${formatNumber(player.xp)} XP`, 
                        inline: true 
                    },
                    { 
                        name: '🎯 Class & Faction', 
                        value: `**Class:** ${player.className}\n**Faction:** ${player.factionId || 'None'}`, 
                        inline: true 
                    },
                    { 
                        name: '📈 Progress Stats', 
                        value: `**Days Active:** ${Math.floor((Date.now() - player.createdAt.getTime()) / (1000 * 60 * 60 * 24))}\n**Member Since:** ${player.createdAt.toDateString()}`, 
                        inline: true 
                    }
                )
                .setColor(rankColor)
                .setFooter({ text: `Requested by ${message.author.username} • Rankings update in real-time` })
                .setTimestamp();

            // Add achievement-like progress bars
            const levelProgress = '█'.repeat(Math.floor(levelPercentile / 10)) + '░'.repeat(10 - Math.floor(levelPercentile / 10));
            const goldProgress = '█'.repeat(Math.floor(goldPercentile / 10)) + '░'.repeat(10 - Math.floor(goldPercentile / 10));
            const eloProgress = '█'.repeat(Math.floor(eloPercentile / 10)) + '░'.repeat(10 - Math.floor(eloPercentile / 10));
            const xpProgress = '█'.repeat(Math.floor(xpPercentile / 10)) + '░'.repeat(10 - Math.floor(xpPercentile / 10));

            embed.addFields({
                name: '📊 Performance Overview',
                value: `**Level:** \`${levelProgress}\` ${levelPercentile}%\n**Wealth:** \`${goldProgress}\` ${goldPercentile}%\n**Combat:** \`${eloProgress}\` ${eloPercentile}%\n**Experience:** \`${xpProgress}\` ${xpPercentile}%`,
                inline: false
            });

            // Add tips for improvement
            const improvements = [];
            if (levelPercentile < 50) improvements.push('💪 Focus on gaining XP through battles and quests');
            if (goldPercentile < 50) improvements.push('💰 Try working, trading, or completing dungeons for gold');
            if (eloPercentile < 50) improvements.push('⚔️ Practice PvP battles to improve your ELO rating');
            if (xpPercentile < 50) improvements.push('📈 Complete more activities to gain experience');

            if (improvements.length > 0) {
                embed.addFields({
                    name: '💡 Improvement Tips',
                    value: improvements.slice(0, 2).join('\n'),
                    inline: false
                });
            }

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Ranking error:', error);
            message.reply('❌ Failed to calculate rankings. Please try again later.');
        }
    }
};

export default command;
