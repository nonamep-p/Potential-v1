import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer } from '../../utils/database.js';
import { prisma } from '../../utils/database.js';
import { formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'guild',
    description: 'Manage or view guild information',
    usage: '$guild [create/join/leave/info/members]',
    category: 'social',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const action = args[0]?.toLowerCase() || 'info';

        switch (action) {
            case 'create':
                await handleCreateGuild(message, player, args.slice(1));
                break;
            case 'join':
                await handleJoinGuild(message, player, args.slice(1));
                break;
            case 'leave':
                await handleLeaveGuild(message, player);
                break;
            case 'members':
                await handleGuildMembers(message, player);
                break;
            case 'deposit':
                await handleGuildDeposit(message, player, args.slice(1));
                break;
            case 'list':
                await handleListGuilds(message);
                break;
            default:
                await handleGuildInfo(message, player);
                break;
        }
    }
};

async function handleCreateGuild(message: any, player: any, args: string[]) {
    if (args.length === 0) {
        return message.reply('❌ You need to provide a guild name! Usage: `$guild create <guild_name>`');
    }

    const guildName = args.join(' ');
    
    if (guildName.length < 3 || guildName.length > 30) {
        return message.reply('❌ Guild name must be between 3 and 30 characters!');
    }

    if (player.gold < 5000) {
        return message.reply('❌ You need 5,000 gold to create a guild!');
    }

    try {
        // Check if player is already in a guild
        const existingGuild = await prisma.guild.findFirst({
            where: {
                OR: [
                    { leaderId: player.discordId },
                    { members: { contains: player.discordId } }
                ]
            }
        });

        if (existingGuild) {
            return message.reply('❌ You are already in a guild! Leave your current guild first.');
        }

        // Check if guild name already exists
        const nameExists = await prisma.guild.findUnique({
            where: { name: guildName }
        });

        if (nameExists) {
            return message.reply('❌ A guild with that name already exists!');
        }

        // Create the guild
        const newGuild = await prisma.guild.create({
            data: {
                name: guildName,
                leaderId: player.discordId,
                members: JSON.stringify([player.discordId]),
                treasury: 0,
                description: `${guildName} - A new guild ready for adventure!`
            }
        });

        // Deduct gold from player
        await prisma.player.update({
            where: { discordId: player.discordId },
            data: { gold: player.gold - 5000 }
        });

        const embed = new EmbedBuilder()
            .setTitle('🏰 Guild Created!')
            .setDescription(`**${guildName}** has been successfully created!`)
            .addFields(
                { name: '👑 Guild Leader', value: player.username, inline: true },
                { name: '👥 Members', value: '1', inline: true },
                { name: '💰 Treasury', value: '0 gold', inline: true },
                { name: '💸 Cost', value: '5,000 gold', inline: true },
                { name: '💵 Your Remaining Gold', value: formatNumber(player.gold - 5000), inline: true }
            )
            .setColor(0x00ff00)
            .setFooter({ text: 'Use $guild info to manage your guild!' });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Guild creation error:', error);
        message.reply('❌ Failed to create guild. Please try again later.');
    }
}

async function handleJoinGuild(message: any, player: any, args: string[]) {
    if (args.length === 0) {
        return message.reply('❌ You need to specify a guild name! Usage: `$guild join <guild_name>`');
    }

    const guildName = args.join(' ');

    try {
        // Check if player is already in a guild
        const existingMembership = await prisma.guild.findFirst({
            where: {
                OR: [
                    { leaderId: player.discordId },
                    { members: { contains: player.discordId } }
                ]
            }
        });

        if (existingMembership) {
            return message.reply('❌ You are already in a guild! Leave your current guild first.');
        }

        // Find the guild
        const guild = await prisma.guild.findFirst({
            where: {
                name: {
                    contains: guildName,
                    mode: 'insensitive'
                }
            }
        });

        if (!guild) {
            return message.reply('❌ Guild not found! Use `$guild list` to see available guilds.');
        }

        // Check member limit (max 20 members)
        const currentMembers = JSON.parse(guild.members);
        if (currentMembers.length >= 20) {
            return message.reply('❌ This guild is full! (Maximum 20 members)');
        }

        // Add player to guild
        currentMembers.push(player.discordId);
        
        await prisma.guild.update({
            where: { id: guild.id },
            data: {
                members: JSON.stringify(currentMembers)
            }
        });

        const embed = new EmbedBuilder()
            .setTitle('🏰 Joined Guild!')
            .setDescription(`Welcome to **${guild.name}**!`)
            .addFields(
                { name: '🏰 Guild', value: guild.name, inline: true },
                { name: '👥 Members', value: `${currentMembers.length}/20`, inline: true },
                { name: '💰 Treasury', value: formatNumber(guild.treasury), inline: true }
            )
            .setColor(0x00ff00)
            .setFooter({ text: 'Use $guild info to see more details!' });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Guild join error:', error);
        message.reply('❌ Failed to join guild. Please try again later.');
    }
}

async function handleLeaveGuild(message: any, player: any) {
    try {
        const guild = await prisma.guild.findFirst({
            where: {
                OR: [
                    { leaderId: player.discordId },
                    { members: { contains: player.discordId } }
                ]
            }
        });

        if (!guild) {
            return message.reply('❌ You are not in a guild!');
        }

        if (guild.leaderId === player.discordId) {
            // Guild leader wants to leave - need to transfer leadership or disband
            const members = JSON.parse(guild.members).filter((id: string) => id !== player.discordId);
            
            if (members.length === 0) {
                // Disband guild
                await prisma.guild.delete({
                    where: { id: guild.id }
                });

                const embed = new EmbedBuilder()
                    .setTitle('🏰 Guild Disbanded')
                    .setDescription(`**${guild.name}** has been disbanded as you were the last member.`)
                    .setColor(0xff0000);

                await message.reply({ embeds: [embed] });
            } else {
                // Transfer leadership to oldest member
                const newLeader = members[0];
                
                await prisma.guild.update({
                    where: { id: guild.id },
                    data: {
                        leaderId: newLeader,
                        members: JSON.stringify(members)
                    }
                });

                const embed = new EmbedBuilder()
                    .setTitle('🏰 Left Guild')
                    .setDescription(`You have left **${guild.name}**. Leadership has been transferred.`)
                    .setColor(0xffff00);

                await message.reply({ embeds: [embed] });
            }
        } else {
            // Regular member leaving
            const members = JSON.parse(guild.members).filter((id: string) => id !== player.discordId);
            
            await prisma.guild.update({
                where: { id: guild.id },
                data: {
                    members: JSON.stringify(members)
                }
            });

            const embed = new EmbedBuilder()
                .setTitle('🏰 Left Guild')
                .setDescription(`You have left **${guild.name}**.`)
                .setColor(0xffff00);

            await message.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Guild leave error:', error);
        message.reply('❌ Failed to leave guild. Please try again later.');
    }
}

async function handleGuildInfo(message: any, player: any) {
    try {
        const guild = await prisma.guild.findFirst({
            where: {
                OR: [
                    { leaderId: player.discordId },
                    { members: { contains: player.discordId } }
                ]
            }
        });

        if (!guild) {
            // Show guild system info
            const embed = new EmbedBuilder()
                .setTitle('🏰 Guild System')
                .setDescription('Join or create a guild to adventure with friends!')
                .addFields(
                    { name: '📋 Commands', value: '`$guild create <name>` - Create a guild (5,000 gold)\n`$guild join <name>` - Join a guild\n`$guild list` - See available guilds\n`$guild info` - View your guild', inline: false },
                    { name: '🎁 Guild Benefits', value: '• Shared treasury for group activities\n• Guild-exclusive events\n• Member cooperation bonuses\n• Social features and chat', inline: false },
                    { name: '⚙️ Guild Features', value: '• Maximum 20 members per guild\n• Democratic leadership transfer\n• Guild treasury system\n• Member management tools', inline: false }
                )
                .setColor(0x8b4513);

            return message.reply({ embeds: [embed] });
        }

        // Show guild information
        const members = JSON.parse(guild.members);
        const leader = await prisma.player.findUnique({
            where: { discordId: guild.leaderId }
        });

        const embed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name}`)
            .setDescription(guild.description || 'No description set.')
            .addFields(
                { name: '👑 Leader', value: leader?.username || 'Unknown', inline: true },
                { name: '👥 Members', value: `${members.length}/20`, inline: true },
                { name: '⭐ Level', value: `${guild.level}`, inline: true },
                { name: '💰 Treasury', value: formatNumber(guild.treasury), inline: true },
                { name: '📅 Created', value: guild.createdAt.toDateString(), inline: true },
                { name: '🎯 Your Role', value: guild.leaderId === player.discordId ? 'Leader' : 'Member', inline: true }
            )
            .setColor(0x8b4513)
            .setFooter({ text: 'Use $guild members to see all members' });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('guild_members')
                    .setLabel('👥 Members')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('guild_deposit')
                    .setLabel('💰 Deposit Gold')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('guild_leave')
                    .setLabel('🚪 Leave Guild')
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

            switch (interaction.customId) {
                case 'guild_members':
                    await handleGuildMembers(response, player);
                    break;
                case 'guild_deposit':
                    await interaction.followUp({
                        content: '💰 Use `$guild deposit <amount>` to deposit gold into the guild treasury!',
                        ephemeral: true
                    });
                    break;
                case 'guild_leave':
                    await interaction.followUp({
                        content: '🚪 Use `$guild leave` to leave the guild!',
                        ephemeral: true
                    });
                    break;
            }
        });

        collector.on('end', () => {
            response.edit({ components: [] });
        });

    } catch (error) {
        console.error('Guild info error:', error);
        message.reply('❌ Failed to load guild information. Please try again later.');
    }
}

async function handleGuildMembers(message: any, player: any) {
    try {
        const guild = await prisma.guild.findFirst({
            where: {
                OR: [
                    { leaderId: player.discordId },
                    { members: { contains: player.discordId } }
                ]
            }
        });

        if (!guild) {
            return message.reply('❌ You are not in a guild!');
        }

        const memberIds = JSON.parse(guild.members);
        const memberData = await prisma.player.findMany({
            where: {
                discordId: { in: memberIds }
            }
        });

        let memberList = '';
        for (const member of memberData) {
            const role = member.discordId === guild.leaderId ? '👑' : '👤';
            memberList += `${role} **${member.username}** (Level ${member.level})\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`👥 ${guild.name} Members`)
            .setDescription(memberList || 'No members found.')
            .addFields({
                name: '📊 Member Count',
                value: `${memberData.length}/20`,
                inline: true
            })
            .setColor(0x8b4513);

        await message.edit({ embeds: [embed], components: [] });

    } catch (error) {
        console.error('Guild members error:', error);
        message.reply('❌ Failed to load guild members. Please try again later.');
    }
}

async function handleGuildDeposit(message: any, player: any, args: string[]) {
    if (args.length === 0) {
        return message.reply('❌ You need to specify an amount! Usage: `$guild deposit <amount>`');
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ Please provide a valid amount to deposit!');
    }

    if (amount > player.gold) {
        return message.reply(`❌ You don't have enough gold! You only have ${formatNumber(player.gold)} gold.`);
    }

    try {
        const guild = await prisma.guild.findFirst({
            where: {
                OR: [
                    { leaderId: player.discordId },
                    { members: { contains: player.discordId } }
                ]
            }
        });

        if (!guild) {
            return message.reply('❌ You are not in a guild!');
        }

        // Update player gold and guild treasury
        await prisma.player.update({
            where: { discordId: player.discordId },
            data: { gold: player.gold - amount }
        });

        await prisma.guild.update({
            where: { id: guild.id },
            data: { treasury: guild.treasury + amount }
        });

        const embed = new EmbedBuilder()
            .setTitle('💰 Gold Deposited!')
            .setDescription(`You deposited ${formatNumber(amount)} gold to **${guild.name}**!`)
            .addFields(
                { name: '💸 Deposited', value: formatNumber(amount), inline: true },
                { name: '💵 Your Remaining Gold', value: formatNumber(player.gold - amount), inline: true },
                { name: '🏰 Guild Treasury', value: formatNumber(guild.treasury + amount), inline: true }
            )
            .setColor(0x00ff00);

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Guild deposit error:', error);
        message.reply('❌ Failed to deposit gold. Please try again later.');
    }
}

async function handleListGuilds(message: any) {
    try {
        const guilds = await prisma.guild.findMany({
            orderBy: { level: 'desc' },
            take: 10
        });

        if (guilds.length === 0) {
            return message.reply('❌ No guilds exist yet! Be the first to create one with `$guild create <name>`!');
        }

        let guildList = '';
        for (const guild of guilds) {
            const memberCount = JSON.parse(guild.members).length;
            guildList += `🏰 **${guild.name}** (Level ${guild.level})\n👥 ${memberCount}/20 members • 💰 ${formatNumber(guild.treasury)} treasury\n\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏰 Guild Directory')
            .setDescription(guildList)
            .setColor(0x8b4513)
            .setFooter({ text: 'Use $guild join <name> to join a guild!' });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Guild list error:', error);
        message.reply('❌ Failed to load guild list. Please try again later.');
    }
}

export default command;
