import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'work',
    description: 'Work various jobs to earn gold',
    usage: '$work [job_type]',
    category: 'economy',
    cooldown: 1800, // 30 minutes
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const now = new Date();
        const lastWork = player.lastWork ? new Date(player.lastWork) : null;

        // Check cooldown
        if (lastWork) {
            const timeSinceLastWork = now.getTime() - lastWork.getTime();
            const minutesRemaining = 30 - Math.floor(timeSinceLastWork / (1000 * 60));

            if (minutesRemaining > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('⏰ Work Cooldown Active')
                    .setDescription(`You're still recovering from your last job! You can work again in **${minutesRemaining} minutes**.`)
                    .setColor(0xff8000)
                    .setFooter({ text: 'Rest is important for productivity!' });

                return message.reply({ embeds: [embed] });
            }
        }

        const jobType = args[0]?.toLowerCase();

        if (!jobType) {
            await showJobSelection(message, player);
        } else {
            await executeJob(message, player, jobType);
        }
    }
};

async function showJobSelection(message: any, player: any) {
    const jobs = [
        {
            id: 'mining',
            name: '⛏️ Mining',
            description: 'Extract valuable ores from deep mines',
            baseReward: 80,
            requirements: 'Level 1+',
            risk: 'Low'
        },
        {
            id: 'hunting',
            name: '🏹 Hunting',
            description: 'Hunt wild animals for meat and pelts',
            baseReward: 120,
            requirements: 'Level 5+',
            risk: 'Medium'
        },
        {
            id: 'trading',
            name: '💼 Trading',
            description: 'Buy and sell goods between towns',
            baseReward: 150,
            requirements: 'Level 10+',
            risk: 'Low'
        },
        {
            id: 'mercenary',
            name: '⚔️ Mercenary Work',
            description: 'Take on dangerous contracts for high pay',
            baseReward: 200,
            requirements: 'Level 15+',
            risk: 'High'
        }
    ];

    const availableJobs = jobs.filter(job => {
        const levelReq = parseInt(job.requirements.match(/\d+/)?.[0] || '1');
        return player.level >= levelReq;
    });

    const embed = new EmbedBuilder()
        .setTitle('💼 Job Board')
        .setDescription('Choose a job to earn gold and experience!')
        .setColor(0x8b4513)
        .addFields({
            name: '💰 Your Current Gold',
            value: formatNumber(player.gold),
            inline: true
        });

    for (const job of availableJobs) {
        const levelBonus = Math.floor((player.level - 1) * job.baseReward * 0.1);
        const estimatedEarnings = job.baseReward + levelBonus;

        embed.addFields({
            name: job.name,
            value: `${job.description}\n**Base Reward:** ${job.baseReward} gold\n**Your Estimated:** ${estimatedEarnings} gold\n**Risk:** ${job.risk}`,
            inline: false
        });
    }

    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const job of availableJobs.slice(0, 4)) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`work_${job.id}`)
                .setLabel(job.name)
                .setStyle(ButtonStyle.Primary)
        );
    }

    const response = await message.reply({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 60000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        
        const jobId = interaction.customId.replace('work_', '');
        await executeJob(response, player, jobId);
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function executeJob(message: any, player: any, jobType: string) {
    const jobData = getJobData(jobType);
    
    if (!jobData) {
        return message.reply('❌ Invalid job type! Use `$work` to see available jobs.');
    }

    const levelReq = jobData.levelRequirement;
    if (player.level < levelReq) {
        return message.reply(`❌ You need to be level ${levelReq} to work as a ${jobData.name}!`);
    }

    // Calculate rewards
    const baseReward = jobData.baseReward;
    const levelBonus = Math.floor((player.level - 1) * baseReward * 0.1);
    const randomBonus = Math.floor(Math.random() * 50) - 25; // -25 to +25
    const classBonus = getClassBonus(player.className, jobType);
    
    let totalGold = baseReward + levelBonus + randomBonus + classBonus;
    let xpReward = Math.floor(totalGold * 0.3);

    // Apply job-specific events
    const jobEvent = generateJobEvent(jobType, player.level);
    if (jobEvent.success) {
        totalGold = Math.floor(totalGold * jobEvent.multiplier);
        xpReward = Math.floor(xpReward * jobEvent.multiplier);
    }

    // Ensure minimum rewards
    totalGold = Math.max(1, totalGold);
    xpReward = Math.max(1, xpReward);

    // Update player
    await updatePlayer(message.author.id, {
        gold: player.gold + totalGold,
        xp: player.xp + xpReward,
        lastWork: new Date()
    });

    const embed = new EmbedBuilder()
        .setTitle(`${jobData.emoji} ${jobData.name} Complete!`)
        .setDescription(jobEvent.description)
        .addFields(
            { name: '💰 Gold Earned', value: formatNumber(totalGold), inline: true },
            { name: '⭐ XP Earned', value: formatNumber(xpReward), inline: true },
            { name: '📊 Efficiency', value: jobEvent.success ? '🔥 Excellent!' : '⚡ Good', inline: true },
            { name: '💵 New Balance', value: formatNumber(player.gold + totalGold), inline: true },
            { name: '🕐 Next Work Available', value: '<t:' + Math.floor((Date.now() + 30 * 60 * 1000) / 1000) + ':R>', inline: true }
        )
        .setColor(jobEvent.success ? 0x00ff00 : 0x8b4513)
        .setFooter({ text: 'Work regularly to build up your wealth!' });

    if (classBonus > 0) {
        embed.addFields({
            name: '🎯 Class Bonus',
            value: `+${classBonus} gold (${player.className} specialization)`,
            inline: false
        });
    }

    await message.reply({ embeds: [embed] });
}

function getJobData(jobType: string) {
    const jobs: Record<string, any> = {
        mining: {
            name: 'Miner',
            emoji: '⛏️',
            baseReward: 80,
            levelRequirement: 1,
            risk: 'low'
        },
        hunting: {
            name: 'Hunter',
            emoji: '🏹',
            baseReward: 120,
            levelRequirement: 5,
            risk: 'medium'
        },
        trading: {
            name: 'Trader',
            emoji: '💼',
            baseReward: 150,
            levelRequirement: 10,
            risk: 'low'
        },
        mercenary: {
            name: 'Mercenary',
            emoji: '⚔️',
            baseReward: 200,
            levelRequirement: 15,
            risk: 'high'
        }
    };

    return jobs[jobType];
}

function getClassBonus(className: string, jobType: string): number {
    const bonuses: Record<string, Record<string, number>> = {
        'Warrior': { mercenary: 20, hunting: 10 },
        'Mage': { trading: 15, mining: 5 },
        'Archer': { hunting: 25, mercenary: 10 },
        'Paladin': { mercenary: 15, trading: 10 }
    };

    return bonuses[className]?.[jobType] || 0;
}

function generateJobEvent(jobType: string, playerLevel: number) {
    const events: Record<string, any[]> = {
        mining: [
            { description: 'You struck a rich vein of ore!', multiplier: 1.5, success: true },
            { description: 'You found some decent ore deposits.', multiplier: 1.0, success: true },
            { description: 'The mine was mostly empty today.', multiplier: 0.8, success: false }
        ],
        hunting: [
            { description: 'You tracked down a rare beast!', multiplier: 1.8, success: true },
            { description: 'Your hunt was successful.', multiplier: 1.0, success: true },
            { description: 'The animals were scarce today.', multiplier: 0.7, success: false }
        ],
        trading: [
            { description: 'You negotiated excellent deals!', multiplier: 1.4, success: true },
            { description: 'Your trades were profitable.', multiplier: 1.0, success: true },
            { description: 'Market prices were unfavorable.', multiplier: 0.9, success: false }
        ],
        mercenary: [
            { description: 'You completed a high-paying contract!', multiplier: 2.0, success: true },
            { description: 'Your mission was accomplished.', multiplier: 1.0, success: true },
            { description: 'The contract was more difficult than expected.', multiplier: 0.8, success: false }
        ]
    };

    const jobEvents = events[jobType] || events.mining;
    const weights = playerLevel >= 20 ? [0.3, 0.5, 0.2] : [0.2, 0.6, 0.2];
    
    const random = Math.random();
    let sum = 0;
    
    for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (random <= sum) {
            return jobEvents[i];
        }
    }
    
    return jobEvents[1];
}

export default command;
