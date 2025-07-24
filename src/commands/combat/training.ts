import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';

const command: Command = {
    name: 'training',
    description: 'Train your combat skills',
    usage: '$training',
    category: 'combat',
    cooldown: 300, // 5 minutes
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.gold < 50) {
            return message.reply('❌ Training costs 50 gold! You need more gold.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🏋️ Combat Training Facility')
            .setDescription('Choose your training focus:')
            .addFields(
                { name: '💪 Strength Training', value: 'Cost: 50 Gold\n+1-3 STR, +5-10 XP', inline: true },
                { name: '🧠 Intelligence Training', value: 'Cost: 50 Gold\n+1-3 INT, +5-10 XP', inline: true },
                { name: '🛡️ Defense Training', value: 'Cost: 50 Gold\n+1-3 DEF, +5-10 XP', inline: true },
                { name: '💨 Speed Training', value: 'Cost: 50 Gold\n+1-3 SPD, +5-10 XP', inline: true },
                { name: '❤️ Endurance Training', value: 'Cost: 100 Gold\n+5-15 Max HP, +10-20 XP', inline: true },
                { name: '💙 Focus Training', value: 'Cost: 100 Gold\n+3-10 Max MP, +10-20 XP', inline: true }
            )
            .setColor(0x8b4513)
            .setFooter({ text: 'Training has a 5-minute cooldown.' });

        const row1 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('train_str')
                    .setLabel('💪 STR')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('train_int')
                    .setLabel('🧠 INT')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('train_def')
                    .setLabel('🛡️ DEF')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('train_spd')
                    .setLabel('💨 SPD')
                    .setStyle(ButtonStyle.Primary)
            );

        const row2 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('train_hp')
                    .setLabel('❤️ HP')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('train_mp')
                    .setLabel('💙 MP')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('train_cancel')
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

        const response = await message.reply({ embeds: [embed], components: [row1, row2] });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === message.author.id,
            time: 60000
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();

            if (interaction.customId === 'train_cancel') {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('❌ Training Cancelled')
                    .setDescription('You decided not to train today.')
                    .setColor(0xff0000);

                await response.edit({ embeds: [cancelEmbed], components: [] });
                return;
            }

            const trainingType = interaction.customId.replace('train_', '');
            const stats = JSON.parse(player.stats);
            let cost = 50;
            let gains = '';
            let xpGain = Math.floor(Math.random() * 6) + 5; // 5-10 XP

            switch (trainingType) {
                case 'str':
                    const strGain = Math.floor(Math.random() * 3) + 1;
                    stats.str += strGain;
                    gains = `+${strGain} STR`;
                    break;
                case 'int':
                    const intGain = Math.floor(Math.random() * 3) + 1;
                    stats.int += intGain;
                    gains = `+${intGain} INT`;
                    break;
                case 'def':
                    const defGain = Math.floor(Math.random() * 3) + 1;
                    stats.def += defGain;
                    gains = `+${defGain} DEF`;
                    break;
                case 'spd':
                    const spdGain = Math.floor(Math.random() * 3) + 1;
                    stats.spd += spdGain;
                    gains = `+${spdGain} SPD`;
                    break;
                case 'hp':
                    cost = 100;
                    const hpGain = Math.floor(Math.random() * 11) + 5;
                    stats.maxHp += hpGain;
                    stats.hp = Math.min(stats.hp + Math.floor(hpGain / 2), stats.maxHp);
                    gains = `+${hpGain} Max HP`;
                    xpGain = Math.floor(Math.random() * 11) + 10; // 10-20 XP
                    break;
                case 'mp':
                    cost = 100;
                    const mpGain = Math.floor(Math.random() * 8) + 3;
                    stats.maxMp += mpGain;
                    stats.mp = Math.min(stats.mp + Math.floor(mpGain / 2), stats.maxMp);
                    gains = `+${mpGain} Max MP`;
                    xpGain = Math.floor(Math.random() * 11) + 10; // 10-20 XP
                    break;
            }

            if (player.gold < cost) {
                await interaction.followUp({
                    content: `❌ You need ${cost} gold for this training!`,
                    ephemeral: true
                });
                return;
            }

            await updatePlayer(message.author.id, {
                stats: JSON.stringify(stats),
                gold: player.gold - cost,
                xp: player.xp + xpGain
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('🏋️ Training Complete!')
                .setDescription('Your training session was successful!')
                .addFields(
                    { name: '📈 Gains', value: gains, inline: true },
                    { name: '⭐ XP Gained', value: `${xpGain}`, inline: true },
                    { name: '💰 Cost', value: `${cost} Gold`, inline: true }
                )
                .setColor(0x00ff00)
                .setFooter({ text: 'Keep training to become stronger!' });

            await response.edit({ embeds: [successEmbed], components: [] });
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                response.edit({ components: [] });
            }
        });
    }
};

export default command;
