import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, getAllPlayers } from '../../utils/database.js';

const command: Command = {
    name: 'arena',
    description: 'Enter the PvP arena and view rankings',
    usage: '$arena',
    category: 'combat',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 10) {
            return message.reply('❌ You need to be at least level 10 to enter the arena!');
        }

        const allPlayers = await getAllPlayers();
        const arenaPlayers = allPlayers
            .filter(p => p.level >= 10)
            .sort((a, b) => b.elo - a.elo)
            .slice(0, 10);

        const playerRank = arenaPlayers.findIndex(p => p.discordId === message.author.id) + 1;

        const embed = new EmbedBuilder()
            .setTitle('🏟️ PvP Arena')
            .setDescription('Welcome to the Arena! Test your skills against other players.')
            .addFields(
                { name: '🏆 Your ELO', value: `${player.elo}`, inline: true },
                { name: '📍 Your Rank', value: playerRank > 0 ? `#${playerRank}` : 'Unranked', inline: true },
                { name: '⚔️ Battles Today', value: '0/5', inline: true }
            )
            .setColor(0xff8000);

        let leaderboard = '';
        for (let i = 0; i < Math.min(5, arenaPlayers.length); i++) {
            const p = arenaPlayers[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            leaderboard += `${medal} **${p.username}** - ${p.elo} ELO (Level ${p.level})\n`;
        }

        embed.addFields({
            name: '🏆 Top Arena Players',
            value: leaderboard || 'No players in arena yet.',
            inline: false
        });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('arena_matchmaking')
                    .setLabel('⚔️ Find Match')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('arena_rewards')
                    .setLabel('🎁 Daily Rewards')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('arena_rules')
                    .setLabel('📋 Rules')
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

            switch (interaction.customId) {
                case 'arena_matchmaking':
                    const matchEmbed = new EmbedBuilder()
                        .setTitle('🔍 Finding Match...')
                        .setDescription('Searching for opponents with similar ELO...')
                        .setColor(0xffff00);

                    await response.edit({ embeds: [matchEmbed], components: [] });

                    // Simulate matchmaking delay
                    setTimeout(async () => {
                        const noMatchEmbed = new EmbedBuilder()
                            .setTitle('❌ No Match Found')
                            .setDescription('No suitable opponents found at this time. Try again later!')
                            .setColor(0xff0000);

                        await response.edit({ embeds: [noMatchEmbed], components: [] });
                    }, 3000);
                    break;

                case 'arena_rewards':
                    const rewardsEmbed = new EmbedBuilder()
                        .setTitle('🎁 Arena Rewards')
                        .setDescription('Daily rewards based on your arena performance:')
                        .addFields(
                            { name: '🥇 Rank 1-3', value: '1000 Gold + Legendary Item', inline: false },
                            { name: '🥈 Rank 4-10', value: '500 Gold + Epic Item', inline: false },
                            { name: '🥉 Rank 11-50', value: '250 Gold + Rare Item', inline: false },
                            { name: '⚔️ Participation', value: '100 Gold + Common Item', inline: false }
                        )
                        .setColor(0xffd700);

                    await response.edit({ embeds: [rewardsEmbed], components: [] });
                    break;

                case 'arena_rules':
                    const rulesEmbed = new EmbedBuilder()
                        .setTitle('📋 Arena Rules')
                        .setDescription('PvP Arena Guidelines:')
                        .addFields(
                            { name: '⚔️ Combat', value: 'Turn-based combat with 30-second turns', inline: false },
                            { name: '🏆 ELO System', value: 'Win/lose ELO based on opponent strength', inline: false },
                            { name: '⏰ Daily Battles', value: 'Maximum 5 ranked battles per day', inline: false },
                            { name: '🎁 Rewards', value: 'Daily rewards based on final ranking', inline: false },
                            { name: '🚫 Restrictions', value: 'Level 10+ required, no healing items', inline: false }
                        )
                        .setColor(0x8b4513);

                    await response.edit({ embeds: [rulesEmbed], components: [] });
                    break;
            }
        });

        collector.on('end', () => {
            response.edit({ components: [] });
        });
    }
};

export default command;
