import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command, Equipment } from '../../types.js';
import { getPlayer } from '../../utils/database.js';
import { getItemById, getRarityEmoji } from '../../utils/helpers.js';

const command: Command = {
    name: 'equipment',
    description: 'View and manage your equipment',
    usage: '$equipment',
    category: 'character',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const equipment: Equipment = JSON.parse(player.equipmentJson || '{}');

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Your Equipment')
            .setColor(0x8b4513);

        let description = '';
        
        // Weapon slot
        if (equipment.weapon) {
            const weapon = getItemById(equipment.weapon);
            if (weapon) {
                const emoji = getRarityEmoji(weapon.rarity);
                description += `🗡️ **Weapon:** ${emoji} ${weapon.name}\n`;
            }
        } else {
            description += '🗡️ **Weapon:** *Empty*\n';
        }

        // Armor slot
        if (equipment.armor) {
            const armor = getItemById(equipment.armor);
            if (armor) {
                const emoji = getRarityEmoji(armor.rarity);
                description += `🛡️ **Armor:** ${emoji} ${armor.name}\n`;
            }
        } else {
            description += '🛡️ **Armor:** *Empty*\n';
        }

        // Accessory slot
        if (equipment.accessory) {
            const accessory = getItemById(equipment.accessory);
            if (accessory) {
                const emoji = getRarityEmoji(accessory.rarity);
                description += `💍 **Accessory:** ${emoji} ${accessory.name}\n`;
            }
        } else {
            description += '💍 **Accessory:** *Empty*\n';
        }

        embed.setDescription(description);

        // Calculate total stats from equipment
        let totalStats = { str: 0, int: 0, def: 0, spd: 0 };
        
        for (const itemId of Object.values(equipment)) {
            if (itemId) {
                const item = getItemById(itemId);
                if (item && item.stats) {
                    totalStats.str += item.stats.str || 0;
                    totalStats.int += item.stats.int || 0;
                    totalStats.def += item.stats.def || 0;
                    totalStats.spd += item.stats.spd || 0;
                }
            }
        }

        embed.addFields({
            name: '📊 Equipment Bonuses',
            value: `STR: +${totalStats.str} | INT: +${totalStats.int} | DEF: +${totalStats.def} | SPD: +${totalStats.spd}`,
            inline: false
        });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('equipment_manage')
                    .setLabel('🔧 Manage Equipment')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('equipment_unequip')
                    .setLabel('❌ Unequip Item')
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

            if (interaction.customId === 'equipment_manage') {
                await interaction.followUp({
                    content: '🔧 Equipment management feature coming soon!',
                    ephemeral: true
                });
            } else if (interaction.customId === 'equipment_unequip') {
                await interaction.followUp({
                    content: '❌ Unequip feature coming soon!',
                    ephemeral: true
                });
            }
        });

        collector.on('end', () => {
            response.edit({ components: [] });
        });
    }
};

export default command;
