import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, getAllPlayers } from '../../utils/database.js';

const command: Command = {
    name: 'raid',
    description: 'Join or create a raid party for challenging dungeons',
    usage: '$raid [create/join/leave/start]',
    category: 'dungeon',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 15) {
            return message.reply('❌ You need to be level 15 or higher to participate in raids!');
        }

        const action = args[0]?.toLowerCase() || 'list';

        switch (action) {
            case 'create':
                await handleCreateRaid(message, player);
                break;
            case 'join':
                await handleJoinRaid(message, player);
                break;
            case 'leave':
                await handleLeaveRaid(message, player);
                break;
            case 'start':
                await handleStartRaid(message, player);
                break;
            default:
                await handleListRaids(message, player);
                break;
        }
    }
};

async function handleCreateRaid(message: any, player: any) {
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Create Raid Party')
        .setDescription('Choose the raid difficulty:')
        .addFields(
            { name: '🟢 Normal Raid', value: 'Level 15+ | 3-5 players | Moderate rewards', inline: true },
            { name: '🟡 Hard Raid', value: 'Level 25+ | 4-6 players | Great rewards', inline: true },
            { name: '🔴 Nightmare Raid', value: 'Level 35+ | 5-8 players | Legendary rewards', inline: true }
        )
        .setColor(0x8b4513);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('raid_normal')
                .setLabel('🟢 Normal')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('raid_hard')
                .setLabel('🟡 Hard')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('raid_nightmare')
                .setLabel('🔴 Nightmare')
                .setStyle(ButtonStyle.Danger)
        );

    const response = await message.reply({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 30000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        
        const difficulty = interaction.customId.replace('raid_', '');
        const minLevel = difficulty === 'normal' ? 15 : difficulty === 'hard' ? 25 : 35;
        
        if (player.level < minLevel) {
            await interaction.followUp({
                content: `❌ You need to be level ${minLevel} to create this raid!`,
                ephemeral: true
            });
            return;
        }

        const createdEmbed = new EmbedBuilder()
            .setTitle(`🛡️ ${difficulty.toUpperCase()} Raid Created!`)
            .setDescription(`${message.author.username} created a ${difficulty} raid party!`)
            .addFields(
                { name: '👥 Party Leader', value: message.author.username, inline: true },
                { name: '📊 Difficulty', value: difficulty.toUpperCase(), inline: true },
                { name: '⭐ Min Level', value: `${minLevel}`, inline: true },
                { name: '👥 Members', value: '1/6', inline: true }
            )
            .setColor(0x00ff00)
            .setFooter({ text: 'Other players can use $raid join to join this party!' });

        await response.edit({ embeds: [createdEmbed], components: [] });
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            response.edit({ components: [] });
        }
    });
}

async function handleJoinRaid(message: any, player: any) {
    const embed = new EmbedBuilder()
        .setTitle('❌ No Active Raids')
        .setDescription('There are currently no active raid parties to join. Create one with `$raid create`!')
        .setColor(0xff0000);

    await message.reply({ embeds: [embed] });
}

async function handleLeaveRaid(message: any, player: any) {
    const embed = new EmbedBuilder()
        .setTitle('❌ Not in Raid')
        .setDescription('You are not currently in a raid party.')
        .setColor(0xff0000);

    await message.reply({ embeds: [embed] });
}

async function handleStartRaid(message: any, player: any) {
    const embed = new EmbedBuilder()
        .setTitle('❌ No Raid to Start')
        .setDescription('You are not the leader of a raid party.')
        .setColor(0xff0000);

    await message.reply({ embeds: [embed] });
}

async function handleListRaids(message: any, player: any) {
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Raid System')
        .setDescription('Team up with other players to tackle challenging raid dungeons!')
        .addFields(
            { name: '📋 Commands', value: '`$raid create` - Create a raid party\n`$raid join` - Join an existing party\n`$raid leave` - Leave your current party\n`$raid start` - Start the raid (leader only)', inline: false },
            { name: '🎁 Raid Rewards', value: 'Raids offer exclusive loot and massive XP bonuses!', inline: false },
            { name: '⚠️ Requirements', value: 'Level 15+ required for Normal raids', inline: false }
        )
        .setColor(0x8b4513)
        .setFooter({ text: 'Raid system coming soon with full multiplayer support!' });

    await message.reply({ embeds: [embed] });
}

export default command;
