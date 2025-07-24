import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'challenge',
    description: 'Challenge another player to various competitions',
    usage: '$challenge @user [type]',
    category: 'social',
    cooldown: 300, // 5 minutes
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ You need to mention a user to challenge! Usage: `$challenge @user [type]`');
        }

        if (target.id === message.author.id) {
            return message.reply('❌ You cannot challenge yourself!');
        }

        if (target.bot) {
            return message.reply('❌ You cannot challenge bots!');
        }

        const targetPlayer = await getPlayer(target.id);
        if (!targetPlayer) {
            return message.reply('❌ The target user has not started their RPG journey yet!');
        }

        const challengeType = args[1]?.toLowerCase() || 'select';

        if (challengeType === 'select') {
            await showChallengeMenu(message, player, target, targetPlayer);
        } else {
            await createChallenge(message, player, target, targetPlayer, challengeType);
        }
    }
};

async function showChallengeMenu(message: any, player: any, target: any, targetPlayer: any) {
    const embed = new EmbedBuilder()
        .setTitle('⚔️ Challenge Selection')
        .setDescription(`Choose how you want to challenge ${target.username}:`)
        .addFields(
            { name: '🗡️ Combat Duel', value: 'Traditional PvP battle', inline: true },
            { name: '🎲 Luck Contest', value: 'Pure RNG competition', inline: true },
            { name: '💰 Wealth Wager', value: 'Bet gold on outcomes', inline: true },
            { name: '🏃 Speed Run', value: 'Race to complete tasks', inline: true },
            { name: '🧠 Trivia Battle', value: 'Test your knowledge', inline: true },
            { name: '🎯 Skill Contest', value: 'Compare character stats', inline: true }
        )
        .setColor(0xff8000)
        .setFooter({ text: 'The challenged player must accept within 60 seconds' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('challenge_combat')
                .setLabel('🗡️ Combat')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('challenge_luck')
                .setLabel('🎲 Luck')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('challenge_wealth')
                .setLabel('💰 Wealth')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('challenge_speed')
                .setLabel('🏃 Speed')
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
        
        const challengeType = interaction.customId.replace('challenge_', '');
        await createChallenge(response, player, target, targetPlayer, challengeType);
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            response.edit({ components: [] });
        }
    });
}

async function createChallenge(message: any, player: any, target: any, targetPlayer: any, type: string) {
    let challengeData = getChallengeData(type);
    if (!challengeData) {
        return message.reply('❌ Invalid challenge type!');
    }

    // Check requirements
    if (challengeData.requirements) {
        const meetsRequirements = checkRequirements(player, challengeData.requirements);
        if (!meetsRequirements.success) {
            return message.reply(`❌ ${meetsRequirements.message}`);
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`${challengeData.emoji} ${challengeData.name} Challenge`)
        .setDescription(`${message.author} challenges ${target} to a ${challengeData.name.toLowerCase()}!`)
        .addFields(
            { name: '🎯 Challenge Type', value: challengeData.name, inline: true },
            { name: '📋 Description', value: challengeData.description, inline: false },
            { name: '🏆 Stakes', value: challengeData.stakes, inline: true },
            { name: '⏱️ Time Limit', value: '60 seconds to accept', inline: true }
        )
        .setColor(challengeData.color)
        .setFooter({ text: `${target.username}, will you accept this challenge?` });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('challenge_accept')
                .setLabel('✅ Accept Challenge')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('challenge_decline')
                .setLabel('❌ Decline Challenge')
                .setStyle(ButtonStyle.Danger)
        );

    const response = await message.edit({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === target.id,
        time: 60000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        if (interaction.customId === 'challenge_accept') {
            await executeChallenge(response, player, target, targetPlayer, challengeData);
        } else {
            const declineEmbed = new EmbedBuilder()
                .setTitle('❌ Challenge Declined')
                .setDescription(`${target.username} declined the ${challengeData.name.toLowerCase()} challenge.`)
                .setColor(0xff0000);

            await response.edit({ embeds: [declineEmbed], components: [] });
        }
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('⏰ Challenge Expired')
                .setDescription('The challenge expired due to no response.')
                .setColor(0x808080);

            response.edit({ embeds: [timeoutEmbed], components: [] });
        }
    });
}

async function executeChallenge(message: any, challenger: any, target: any, targetPlayer: any, challengeData: any) {
    let result = { winner: null, loser: null, tie: false, details: '' };

    switch (challengeData.type) {
        case 'combat':
            result = executeCombatChallenge(challenger, targetPlayer);
            break;
        case 'luck':
            result = executeLuckChallenge(challenger, targetPlayer);
            break;
        case 'wealth':
            result = executeWealthChallenge(challenger, targetPlayer);
            break;
        case 'speed':
            result = executeSpeedChallenge(challenger, targetPlayer);
            break;
        default:
            result = executeLuckChallenge(challenger, targetPlayer);
            break;
    }

    // Calculate rewards
    const rewards = calculateChallengeRewards(challengeData.type, result);

    // Update players
    if (!result.tie && result.winner && result.loser) {
        await updatePlayer(result.winner.discordId, {
            gold: result.winner.gold + rewards.gold,
            xp: result.winner.xp + rewards.xp,
            elo: result.winner.elo + rewards.elo
        });

        await updatePlayer(result.loser.discordId, {
            elo: Math.max(800, result.loser.elo - Math.floor(rewards.elo / 2))
        });
    }

    // Create result embed
    const resultEmbed = new EmbedBuilder()
        .setTitle(`${challengeData.emoji} Challenge Complete!`)
        .setDescription(result.details)
        .setColor(result.tie ? 0xffff00 : 0x00ff00);

    if (!result.tie && result.winner) {
        resultEmbed.addFields(
            { name: '🏆 Winner', value: result.winner.username, inline: true },
            { name: '💰 Gold Reward', value: formatNumber(rewards.gold), inline: true },
            { name: '⭐ XP Reward', value: formatNumber(rewards.xp), inline: true },
            { name: '🏟️ ELO Change', value: `+${rewards.elo}`, inline: true }
        );
    }

    resultEmbed.setFooter({ text: 'Great challenge! Both players gain experience from competition.' });

    await message.edit({ embeds: [resultEmbed], components: [] });
}

function getChallengeData(type: string) {
    const challenges: Record<string, any> = {
        combat: {
            type: 'combat',
            name: 'Combat Duel',
            emoji: '🗡️',
            description: 'A battle of strength and skill',
            stakes: 'ELO rating and combat experience',
            color: 0xff0000,
            requirements: { minLevel: 5 }
        },
        luck: {
            type: 'luck',
            name: 'Luck Contest',
            emoji: '🎲',
            description: 'Pure chance determines the winner',
            stakes: 'Gold and bragging rights',
            color: 0x8b4513
        },
        wealth: {
            type: 'wealth',
            name: 'Wealth Wager',
            emoji: '💰',
            description: 'Risk gold for greater rewards',
            stakes: 'Significant gold amounts',
            color: 0xffd700,
            requirements: { minGold: 1000 }
        },
        speed: {
            type: 'speed',
            name: 'Speed Run',
            emoji: '🏃',
            description: 'Race to complete a task',
            stakes: 'Speed-based rewards',
            color: 0x00ff00
        }
    };

    return challenges[type];
}

function checkRequirements(player: any, requirements: any) {
    if (requirements.minLevel && player.level < requirements.minLevel) {
        return { success: false, message: `You need to be level ${requirements.minLevel} for this challenge!` };
    }

    if (requirements.minGold && player.gold < requirements.minGold) {
        return { success: false, message: `You need ${formatNumber(requirements.minGold)} gold for this challenge!` };
    }

    return { success: true, message: '' };
}

function executeCombatChallenge(challenger: any, target: any) {
    const challengerStats = JSON.parse(challenger.stats);
    const targetStats = JSON.parse(target.stats);

    const challengerPower = challengerStats.str + challengerStats.def + Math.random() * 50;
    const targetPower = targetStats.str + targetStats.def + Math.random() * 50;

    const winner = challengerPower > targetPower ? challenger : target;
    const loser = challengerPower > targetPower ? target : challenger;

    return {
        winner,
        loser,
        tie: false,
        details: `⚔️ **${winner.username}** emerged victorious in combat!\n\n**Combat Power:**\n${challenger.username}: ${Math.floor(challengerPower)}\n${target.username}: ${Math.floor(targetPower)}`
    };
}

function executeLuckChallenge(challenger: any, target: any) {
    const challengerRoll = Math.floor(Math.random() * 100) + 1;
    const targetRoll = Math.floor(Math.random() * 100) + 1;

    if (challengerRoll === targetRoll) {
        return {
            winner: null,
            loser: null,
            tie: true,
            details: `🎲 **It's a tie!** Both rolled ${challengerRoll}!\n\nSometimes luck favors no one.`
        };
    }

    const winner = challengerRoll > targetRoll ? challenger : target;
    const loser = challengerRoll > targetRoll ? target : challenger;

    return {
        winner,
        loser,
        tie: false,
        details: `🎲 **${winner.username}** got lucky!\n\n**Luck Rolls:**\n${challenger.username}: ${challengerRoll}\n${target.username}: ${targetRoll}`
    };
}

function executeWealthChallenge(challenger: any, target: any) {
    const challengerWealth = challenger.gold + (challenger.level * 100);
    const targetWealth = target.gold + (target.level * 100);

    const winner = challengerWealth > targetWealth ? challenger : target;
    const loser = challengerWealth > targetWealth ? target : challenger;

    return {
        winner,
        loser,
        tie: false,
        details: `💰 **${winner.username}** has superior wealth!\n\n**Total Worth:**\n${challenger.username}: ${formatNumber(challengerWealth)}\n${target.username}: ${formatNumber(targetWealth)}`
    };
}

function executeSpeedChallenge(challenger: any, target: any) {
    const challengerStats = JSON.parse(challenger.stats);
    const targetStats = JSON.parse(target.stats);

    const challengerSpeed = challengerStats.spd + Math.random() * 20;
    const targetSpeed = targetStats.spd + Math.random() * 20;

    const winner = challengerSpeed > targetSpeed ? challenger : target;
    const loser = challengerSpeed > targetSpeed ? target : challenger;

    return {
        winner,
        loser,
        tie: false,
        details: `🏃 **${winner.username}** was faster!\n\n**Speed Score:**\n${challenger.username}: ${Math.floor(challengerSpeed)}\n${target.username}: ${Math.floor(targetSpeed)}`
    };
}

function calculateChallengeRewards(type: string, result: any) {
    const baseRewards = {
        combat: { gold: 200, xp: 100, elo: 25 },
        luck: { gold: 150, xp: 50, elo: 15 },
        wealth: { gold: 500, xp: 75, elo: 20 },
        speed: { gold: 100, xp: 80, elo: 18 }
    };

    return baseRewards[type as keyof typeof baseRewards] || baseRewards.luck;
}

export default command;
