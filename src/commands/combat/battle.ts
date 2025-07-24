import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer } from '../../utils/database.js';
import { getAllMonsters, getRandomElement } from '../../utils/helpers.js';
import { CombatManager } from '../../structures/CombatManager.js';

const command: Command = {
    name: 'battle',
    description: 'Fight a random monster',
    usage: '$battle',
    category: 'combat',
    cooldown: 30,
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        // Check if already in combat
        if (CombatManager.getCombat(message.author.id)) {
            return message.reply('❌ You are already in combat!');
        }

        const stats = JSON.parse(player.stats);
        if (stats.hp <= 0) {
            return message.reply('❌ You need to heal before entering combat! Your HP is 0.');
        }

        // Get monsters appropriate for player level
        const allMonsters = getAllMonsters();
        const suitableMonsters = allMonsters.filter(monster => 
            monster.level >= Math.max(1, player.level - 2) && 
            monster.level <= player.level + 3
        );

        if (suitableMonsters.length === 0) {
            return message.reply('❌ No suitable monsters found for your level!');
        }

        const randomMonster = getRandomElement(suitableMonsters);

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Wild Monster Encounter!')
            .setDescription(`A wild **${randomMonster.name}** (Level ${randomMonster.level}) appears!`)
            .addFields(
                { name: '❤️ Monster HP', value: `${randomMonster.hp}`, inline: true },
                { name: '⚔️ Monster STR', value: `${randomMonster.str}`, inline: true },
                { name: '🛡️ Monster DEF', value: `${randomMonster.def}`, inline: true },
                { name: '📝 Description', value: randomMonster.description, inline: false }
            )
            .setColor(0xff0000);

        if (randomMonster.weakness) {
            embed.addFields({
                name: '💥 Weakness',
                value: randomMonster.weakness,
                inline: false
            });
        }

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('battle_start')
                    .setLabel('⚔️ Start Battle')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('battle_flee')
                    .setLabel('🏃 Flee')
                    .setStyle(ButtonStyle.Secondary)
            );

        const response = await message.reply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === message.author.id,
            time: 30000
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();

            if (interaction.customId === 'battle_start') {
                try {
                    await CombatManager.startCombat(message.author.id, randomMonster.id);
                    
                    const combatEmbed = new EmbedBuilder()
                        .setTitle(`⚔️ Combat Started: ${randomMonster.name}`)
                        .setDescription('Combat has begun! Choose your action.')
                        .setColor(0xff8000);

                    await response.edit({ embeds: [combatEmbed], components: [] });
                    
                    // Start the combat loop
                    await CombatManager.executeTurn(response, 'start');
                } catch (error) {
                    await interaction.followUp({
                        content: '❌ Failed to start combat. Please try again.',
                        ephemeral: true
                    });
                }
            } else if (interaction.customId === 'battle_flee') {
                const fleeEmbed = new EmbedBuilder()
                    .setTitle('🏃 Fled from Battle')
                    .setDescription('You successfully fled from the encounter!')
                    .setColor(0xffff00);

                await response.edit({ embeds: [fleeEmbed], components: [] });
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
