import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';

const command: Command = {
    name: 'faction',
    description: 'View or join a faction',
    usage: '$faction [faction_name]',
    category: 'character',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const factions = {
            'light': {
                name: 'Order of Light',
                description: 'Holy warriors dedicated to justice and protection',
                bonuses: '+10% healing, +5% defense',
                requirement: 'Level 5+, Good alignment'
            },
            'shadow': {
                name: 'Shadow Guild',
                description: 'Stealthy rogues who work from the darkness',
                bonuses: '+10% critical chance, +5% speed',
                requirement: 'Level 5+, Neutral/Evil alignment'
            },
            'nature': {
                name: 'Circle of Nature',
                description: 'Druids and rangers who protect the natural world',
                bonuses: '+10% MP regeneration, +5% resistance',
                requirement: 'Level 5+, Nature affinity'
            },
            'arcane': {
                name: 'Arcane Consortium',
                description: 'Mages seeking ultimate magical knowledge',
                bonuses: '+15% magic damage, +10% MP',
                requirement: 'Level 10+, High INT'
            }
        };

        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('🏛️ Factions')
                .setDescription(`Current Faction: **${player.factionId || 'None'}**`)
                .setColor(0x8b4513);

            for (const [key, faction] of Object.entries(factions)) {
                embed.addFields({
                    name: `${faction.name}`,
                    value: `${faction.description}\n**Bonuses:** ${faction.bonuses}\n**Requirement:** ${faction.requirement}`,
                    inline: false
                });
            }

            embed.setFooter({ text: 'Use $faction <faction_name> to join a faction' });
            await message.reply({ embeds: [embed] });
            return;
        }

        const factionKey = args[0].toLowerCase();
        const faction = factions[factionKey as keyof typeof factions];

        if (!faction) {
            return message.reply('❌ Invalid faction! Use `$faction` to see available factions.');
        }

        if (player.factionId === faction.name) {
            return message.reply('❌ You are already a member of this faction!');
        }

        if (player.level < 5) {
            return message.reply('❌ You need to be at least level 5 to join a faction!');
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle(`🏛️ Join ${faction.name}`)
            .setDescription(`Do you want to join the **${faction.name}**?`)
            .addFields(
                { name: '📋 Description', value: faction.description, inline: false },
                { name: '🎁 Bonuses', value: faction.bonuses, inline: false }
            )
            .setColor(0x8b4513);

        if (player.factionId) {
            confirmEmbed.addFields({
                name: '⚠️ Warning',
                value: `You will leave **${player.factionId}** and lose its bonuses!`,
                inline: false
            });
        }

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('faction_join')
                    .setLabel('✅ Join Faction')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('faction_cancel')
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

        const response = await message.reply({ embeds: [confirmEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === message.author.id,
            time: 30000
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();

            if (interaction.customId === 'faction_join') {
                await updatePlayer(message.author.id, {
                    factionId: faction.name
                });

                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Faction Joined!')
                    .setDescription(`Welcome to the **${faction.name}**!`)
                    .addFields({
                        name: '🎁 Bonuses Active',
                        value: faction.bonuses,
                        inline: false
                    })
                    .setColor(0x00ff00);

                await response.edit({ embeds: [successEmbed], components: [] });
            } else {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('❌ Faction Join Cancelled')
                    .setDescription('You remain in your current faction.')
                    .setColor(0xff0000);

                await response.edit({ embeds: [cancelEmbed], components: [] });
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                response.edit({ components: [] });
            }
        });
    }
};

export default command;
