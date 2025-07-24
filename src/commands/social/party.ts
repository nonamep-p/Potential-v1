import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer } from '../../utils/database.js';

// Temporary in-memory party storage (in production, this would be in database)
const activeParties = new Map<string, {
    leaderId: string;
    members: string[];
    maxSize: number;
    purpose: string;
    createdAt: Date;
}>();

const command: Command = {
    name: 'party',
    description: 'Create or join temporary adventure parties',
    usage: '$party [create/join/leave/list/info]',
    category: 'social',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const action = args[0]?.toLowerCase() || 'info';

        switch (action) {
            case 'create':
                await handleCreateParty(message, player, args.slice(1));
                break;
            case 'join':
                await handleJoinParty(message, player, args.slice(1));
                break;
            case 'leave':
                await handleLeaveParty(message, player);
                break;
            case 'list':
                await handleListParties(message);
                break;
            case 'invite':
                await handleInviteToParty(message, player, args.slice(1));
                break;
            default:
                await handlePartyInfo(message, player);
                break;
        }
    }
};

async function handleCreateParty(message: any, player: any, args: string[]) {
    // Check if player is already in a party
    const existingParty = findPlayerParty(player.discordId);
    if (existingParty) {
        return message.reply('❌ You are already in a party! Leave your current party first.');
    }

    const purpose = args.join(' ') || 'General Adventure';
    
    if (purpose.length > 50) {
        return message.reply('❌ Party purpose must be 50 characters or less!');
    }

    const embed = new EmbedBuilder()
        .setTitle('🎉 Create Adventure Party')
        .setDescription('Choose your party configuration:')
        .addFields(
            { name: '👥 Small Party', value: '2-3 members\nBest for quick missions', inline: true },
            { name: '🎯 Standard Party', value: '4-5 members\nBalanced for most content', inline: true },
            { name: '🛡️ Large Party', value: '6-8 members\nIdeal for raids and dungeons', inline: true }
        )
        .setColor(0x8b4513)
        .setFooter({ text: `Purpose: ${purpose}` });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('party_small')
                .setLabel('👥 Small (3)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('party_standard')
                .setLabel('🎯 Standard (5)')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('party_large')
                .setLabel('🛡️ Large (8)')
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

        let maxSize: number;
        switch (interaction.customId) {
            case 'party_small':
                maxSize = 3;
                break;
            case 'party_standard':
                maxSize = 5;
                break;
            case 'party_large':
                maxSize = 8;
                break;
            default:
                maxSize = 5;
        }

        // Create the party
        const partyId = `party_${Date.now()}_${player.discordId}`;
        activeParties.set(partyId, {
            leaderId: player.discordId,
            members: [player.discordId],
            maxSize,
            purpose,
            createdAt: new Date()
        });

        const successEmbed = new EmbedBuilder()
            .setTitle('🎉 Party Created!')
            .setDescription(`Your adventure party has been created!`)
            .addFields(
                { name: '👑 Party Leader', value: player.username, inline: true },
                { name: '👥 Members', value: `1/${maxSize}`, inline: true },
                { name: '🎯 Purpose', value: purpose, inline: true },
                { name: '🆔 Party ID', value: partyId.split('_')[1], inline: false }
            )
            .setColor(0x00ff00)
            .setFooter({ text: 'Share the Party ID with friends so they can join!' });

        await response.edit({ embeds: [successEmbed], components: [] });
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            response.edit({ components: [] });
        }
    });
}

async function handleJoinParty(message: any, player: any, args: string[]) {
    if (args.length === 0) {
        return message.reply('❌ You need to provide a Party ID! Usage: `$party join <party_id>`');
    }

    const partyId = `party_${args[0]}_`;
    let targetParty: string | null = null;

    // Find party by partial ID
    for (const [fullId, party] of activeParties.entries()) {
        if (fullId.startsWith(partyId)) {
            targetParty = fullId;
            break;
        }
    }

    if (!targetParty) {
        return message.reply('❌ Party not found! Make sure you have the correct Party ID.');
    }

    const party = activeParties.get(targetParty)!;

    // Check if player is already in a party
    const existingParty = findPlayerParty(player.discordId);
    if (existingParty) {
        return message.reply('❌ You are already in a party! Leave your current party first.');
    }

    // Check if party is full
    if (party.members.length >= party.maxSize) {
        return message.reply('❌ This party is full!');
    }

    // Add player to party
    party.members.push(player.discordId);
    activeParties.set(targetParty, party);

    const embed = new EmbedBuilder()
        .setTitle('🎉 Joined Party!')
        .setDescription(`Welcome to the adventure party!`)
        .addFields(
            { name: '👥 Members', value: `${party.members.length}/${party.maxSize}`, inline: true },
            { name: '🎯 Purpose', value: party.purpose, inline: true },
            { name: '📅 Created', value: party.createdAt.toLocaleString(), inline: true }
        )
        .setColor(0x00ff00);

    await message.reply({ embeds: [embed] });
}

async function handleLeaveParty(message: any, player: any) {
    const partyData = findPlayerParty(player.discordId);
    if (!partyData) {
        return message.reply('❌ You are not in a party!');
    }

    const { partyId, party } = partyData;

    if (party.leaderId === player.discordId) {
        // Leader leaving - disband party or transfer leadership
        if (party.members.length === 1) {
            activeParties.delete(partyId);
            return message.reply('🎉 Party disbanded as you were the last member.');
        } else {
            // Transfer leadership to next member
            party.members = party.members.filter(id => id !== player.discordId);
            party.leaderId = party.members[0];
            activeParties.set(partyId, party);
            
            return message.reply('👑 You left the party and leadership was transferred.');
        }
    } else {
        // Regular member leaving
        party.members = party.members.filter(id => id !== player.discordId);
        activeParties.set(partyId, party);
        
        return message.reply('👋 You left the party.');
    }
}

async function handlePartyInfo(message: any, player: any) {
    const partyData = findPlayerParty(player.discordId);
    
    if (!partyData) {
        // Show party system info
        const embed = new EmbedBuilder()
            .setTitle('🎉 Adventure Party System')
            .setDescription('Form temporary parties for group activities!')
            .addFields(
                { name: '📋 Commands', value: '`$party create [purpose]` - Create a party\n`$party join <party_id>` - Join a party\n`$party list` - See active parties\n`$party leave` - Leave your party', inline: false },
                { name: '🎁 Party Benefits', value: '• Coordinate group activities\n• Share adventure experiences\n• Temporary social groups\n• Easy member management', inline: false },
                { name: '⚙️ Party Features', value: '• Multiple party sizes (3, 5, or 8)\n• Leader management system\n• Purpose-based organization\n• Automatic cleanup', inline: false }
            )
            .setColor(0x8b4513);

        return message.reply({ embeds: [embed] });
    }

    const { partyId, party } = partyData;
    
    // Get member usernames
    const memberNames: string[] = [];
    for (const memberId of party.members) {
        try {
            const memberPlayer = await getPlayer(memberId);
            const role = memberId === party.leaderId ? '👑' : '👤';
            memberNames.push(`${role} ${memberPlayer?.username || 'Unknown'}`);
        } catch {
            memberNames.push('👤 Unknown');
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('🎉 Your Adventure Party')
        .addFields(
            { name: '👥 Members', value: memberNames.join('\n') || 'No members', inline: false },
            { name: '📊 Party Size', value: `${party.members.length}/${party.maxSize}`, inline: true },
            { name: '🎯 Purpose', value: party.purpose, inline: true },
            { name: '🆔 Party ID', value: partyId.split('_')[1], inline: true },
            { name: '📅 Created', value: party.createdAt.toLocaleString(), inline: true },
            { name: '👑 Your Role', value: party.leaderId === player.discordId ? 'Leader' : 'Member', inline: true }
        )
        .setColor(0x8b4513)
        .setFooter({ text: 'Share the Party ID with friends!' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('party_invite')
                .setLabel('📧 Get Invite Link')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('party_leave_confirm')
                .setLabel('🚪 Leave Party')
                .setStyle(ButtonStyle.Danger)
        );

    const response = await message.reply({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 60000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        if (interaction.customId === 'party_invite') {
            await interaction.followUp({
                content: `📧 **Party Invite Link:**\nTell your friends to use: \`$party join ${partyId.split('_')[1]}\`\n\n**Party Purpose:** ${party.purpose}`,
                ephemeral: true
            });
        } else if (interaction.customId === 'party_leave_confirm') {
            await interaction.followUp({
                content: '🚪 Use `$party leave` to leave the party.',
                ephemeral: true
            });
        }
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function handleListParties(message: any) {
    if (activeParties.size === 0) {
        return message.reply('❌ No active parties! Create one with `$party create [purpose]`');
    }

    let partyList = '';
    let count = 0;
    
    for (const [partyId, party] of activeParties.entries()) {
        if (count >= 5) break; // Limit to 5 parties
        
        try {
            const leaderPlayer = await getPlayer(party.leaderId);
            const shortId = partyId.split('_')[1];
            partyList += `🎉 **${party.purpose}**\n👑 ${leaderPlayer?.username || 'Unknown'} | 👥 ${party.members.length}/${party.maxSize}\n🆔 \`${shortId}\`\n\n`;
            count++;
        } catch {
            continue;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('🎉 Active Adventure Parties')
        .setDescription(partyList || 'No parties available.')
        .setColor(0x8b4513)
        .setFooter({ text: 'Use $party join <party_id> to join a party!' });

    await message.reply({ embeds: [embed] });
}

async function handleInviteToParty(message: any, player: any, args: string[]) {
    const targetUser = message.mentions.users.first();
    if (!targetUser) {
        return message.reply('❌ You need to mention a user to invite! Usage: `$party invite @user`');
    }

    const partyData = findPlayerParty(player.discordId);
    if (!partyData) {
        return message.reply('❌ You are not in a party!');
    }

    const { party } = partyData;
    if (party.leaderId !== player.discordId) {
        return message.reply('❌ Only the party leader can send invites!');
    }

    // This would send a DM or create an invitation system
    await message.reply(`📧 Invitation feature coming soon! For now, tell ${targetUser.username} to use: \`$party join ${partyData.partyId.split('_')[1]}\``);
}

function findPlayerParty(playerId: string): { partyId: string; party: any } | null {
    for (const [partyId, party] of activeParties.entries()) {
        if (party.members.includes(playerId)) {
            return { partyId, party };
        }
    }
    return null;
}

// Cleanup old parties (run periodically)
setInterval(() => {
    const now = new Date();
    for (const [partyId, party] of activeParties.entries()) {
        // Remove parties older than 24 hours
        if (now.getTime() - party.createdAt.getTime() > 24 * 60 * 60 * 1000) {
            activeParties.delete(partyId);
        }
    }
}, 60 * 60 * 1000); // Check every hour

export default command;
