import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { getAllScenarios, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'portal',
    description: 'Discover mysterious portals to other worlds',
    usage: '$portal [explore/enter]',
    category: 'isekai',
    cooldown: 1800, // 30 minutes
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        if (player.level < 15) {
            return message.reply('❌ You need to be level 15 or higher to sense dimensional portals!');
        }

        const action = args[0]?.toLowerCase() || 'discover';

        switch (action) {
            case 'explore':
            case 'enter':
                await handlePortalExploration(message, player);
                break;
            default:
                await handlePortalDiscovery(message, player);
                break;
        }
    }
};

async function handlePortalDiscovery(message: any, player: any) {
    // Random portal discovery
    const portalChance = Math.random();
    let portalFound = false;
    let portalType = '';
    let portalDescription = '';
    let portalEmoji = '';

    if (portalChance < 0.7) {
        portalFound = true;
        const portals = [
            {
                type: 'Fantasy Realm',
                emoji: '🏰',
                description: 'A shimmering portal leading to a medieval fantasy world filled with magic and dragons.',
                color: 0x8b4513
            },
            {
                type: 'Cyberpunk City',
                emoji: '🌃',
                description: 'A neon-lit portal crackling with electricity, showing glimpses of a futuristic metropolis.',
                color: 0x00ffff
            },
            {
                type: 'Ancient Ruins',
                emoji: '🏛️',
                description: 'An ethereal portal surrounded by mysterious ancient symbols and forgotten knowledge.',
                color: 0xffd700
            },
            {
                type: 'Magical Academy',
                emoji: '🎓',
                description: 'A scholarly portal emanating magical energy, leading to a world of learning and wonder.',
                color: 0x9400d3
            },
            {
                type: 'Demon Realm',
                emoji: '😈',
                description: 'A dark, foreboding portal with ominous red energy swirling within its depths.',
                color: 0x8b0000
            },
            {
                type: 'Sky Kingdom',
                emoji: '☁️',
                description: 'A celestial portal floating in the air, showing clouds and floating islands beyond.',
                color: 0x87ceeb
            }
        ];

        const selectedPortal = portals[Math.floor(Math.random() * portals.length)];
        portalType = selectedPortal.type;
        portalDescription = selectedPortal.description;
        portalEmoji = selectedPortal.emoji;
    }

    if (portalFound) {
        const embed = new EmbedBuilder()
            .setTitle(`${portalEmoji} Portal Discovered!`)
            .setDescription(`You've discovered a portal to the **${portalType}**!`)
            .addFields(
                { name: '🌀 Portal Details', value: portalDescription, inline: false },
                { name: '⚠️ Warning', value: 'Entering unknown portals can be dangerous but may lead to great rewards!', inline: false },
                { name: '🎯 Requirements', value: `Level ${player.level >= 20 ? '✅' : '❌'} 20+ recommended\n${player.gold >= 500 ? '✅' : '❌'} 500+ gold recommended`, inline: false }
            )
            .setColor(0x9400d3)
            .setFooter({ text: 'The portal seems stable but may not last long...' });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('portal_enter')
                    .setLabel(`🌀 Enter ${portalType}`)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('portal_study')
                    .setLabel('📚 Study Portal')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('portal_ignore')
                    .setLabel('🚪 Ignore Portal')
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
                case 'portal_enter':
                    await executePortalEntry(response, player, portalType, portalEmoji);
                    break;
                case 'portal_study':
                    await studyPortal(response, player, portalType);
                    break;
                case 'portal_ignore':
                    const ignoreEmbed = new EmbedBuilder()
                        .setTitle('🚪 Portal Ignored')
                        .setDescription('You decide the portal is too risky and walk away. The portal fades behind you.')
                        .setColor(0x808080);
                    
                    await response.edit({ embeds: [ignoreEmbed], components: [] });
                    break;
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Portal Faded')
                    .setDescription('You took too long to decide. The portal shimmers and disappears.')
                    .setColor(0x808080);
                
                response.edit({ embeds: [timeoutEmbed], components: [] });
            }
        });

    } else {
        const embed = new EmbedBuilder()
            .setTitle('🔍 Portal Search')
            .setDescription('You search for dimensional portals but find none this time.')
            .addFields(
                { name: '🌀 Search Result', value: 'No portals detected in the area', inline: false },
                { name: '💡 Tip', value: 'Portals are rare and random. Keep exploring different areas!', inline: false },
                { name: '⏰ Cooldown', value: 'You can search again in 30 minutes', inline: false }
            )
            .setColor(0x696969)
            .setFooter({ text: 'The dimensional fabric seems quiet today...' });

        await message.reply({ embeds: [embed] });
    }
}

async function handlePortalExploration(message: any, player: any) {
    const activePortals = getActivePortals();
    
    if (activePortals.length === 0) {
        return message.reply('❌ There are no active portals to explore! Use `$portal` to search for new ones.');
    }

    // For simplicity, randomly select one active portal
    const portal = activePortals[Math.floor(Math.random() * activePortals.length)];
    await executePortalEntry(message, player, portal.type, portal.emoji);
}

async function executePortalEntry(message: any, player: any, portalType: string, portalEmoji: string) {
    const entryCost = 200;
    
    if (player.gold < entryCost) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Insufficient Funds')
            .setDescription(`You need ${entryCost} gold to safely enter the portal!`)
            .setColor(0xff0000);
        
        await message.edit({ embeds: [embed], components: [] });
        return;
    }

    // Portal entry simulation
    const outcomes = [
        {
            type: 'treasure',
            weight: 30,
            title: '💰 Treasure Discovery',
            description: 'You found ancient treasures in the other world!',
            goldReward: Math.floor(Math.random() * 800) + 400,
            xpReward: Math.floor(Math.random() * 200) + 100,
            color: 0xffd700
        },
        {
            type: 'knowledge',
            weight: 25,
            title: '📚 Ancient Knowledge',
            description: 'You learned secrets from another dimension!',
            goldReward: Math.floor(Math.random() * 300) + 200,
            xpReward: Math.floor(Math.random() * 400) + 300,
            color: 0x9400d3
        },
        {
            type: 'ally',
            weight: 20,
            title: '🤝 Otherworldly Ally',
            description: 'You made friends with beings from another world!',
            goldReward: Math.floor(Math.random() * 500) + 300,
            xpReward: Math.floor(Math.random() * 250) + 150,
            color: 0x00ff00
        },
        {
            type: 'challenge',
            weight: 15,
            title: '⚔️ Dimensional Challenge',
            description: 'You faced and overcame otherworldly challenges!',
            goldReward: Math.floor(Math.random() * 600) + 500,
            xpReward: Math.floor(Math.random() * 300) + 200,
            color: 0xff4500
        },
        {
            type: 'danger',
            weight: 10,
            title: '💀 Narrow Escape',
            description: 'You barely escaped from a dangerous situation!',
            goldReward: 0,
            xpReward: Math.floor(Math.random() * 100) + 50,
            color: 0xff0000
        }
    ];

    // Weighted random selection
    const totalWeight = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedOutcome = outcomes[0];

    for (const outcome of outcomes) {
        random -= outcome.weight;
        if (random <= 0) {
            selectedOutcome = outcome;
            break;
        }
    }

    // Apply rewards and costs
    const newGold = Math.max(0, player.gold - entryCost + selectedOutcome.goldReward);
    const newXp = player.xp + selectedOutcome.xpReward;

    await updatePlayer(player.discordId, {
        gold: newGold,
        xp: newXp
    });

    // Check for scenario trigger
    const shouldTriggerScenario = Math.random() < 0.15; // 15% chance
    let scenarioText = '';

    if (shouldTriggerScenario) {
        const scenarios = getAllScenarios();
        const portalScenarios = scenarios.filter(s => s.trigger === 'portal');
        
        if (portalScenarios.length > 0) {
            const scenario = portalScenarios[Math.floor(Math.random() * portalScenarios.length)];
            const completedScenarios = JSON.parse(player.completedScenariosJson || '[]');
            
            if (!completedScenarios.includes(scenario.id)) {
                scenarioText = `\n\n🌟 **Isekai Scenario Triggered: ${scenario.name}**\n*${scenario.plaggDialogue}*`;
                
                // Mark scenario as completed and give rewards
                completedScenarios.push(scenario.id);
                await updatePlayer(player.discordId, {
                    completedScenariosJson: JSON.stringify(completedScenarios),
                    gold: newGold + (scenario.rewards.gold || 0),
                    xp: newXp + (scenario.rewards.xp || 0)
                });
            }
        }
    }

    const resultEmbed = new EmbedBuilder()
        .setTitle(`${portalEmoji} ${selectedOutcome.title}`)
        .setDescription(`${selectedOutcome.description}${scenarioText}`)
        .addFields(
            { name: '🌀 Portal Entered', value: portalType, inline: true },
            { name: '💸 Entry Cost', value: formatNumber(entryCost), inline: true },
            { name: '💰 Gold Gained', value: formatNumber(selectedOutcome.goldReward), inline: true },
            { name: '⭐ XP Gained', value: formatNumber(selectedOutcome.xpReward), inline: true },
            { name: '💵 New Balance', value: formatNumber(newGold), inline: true },
            { name: '📊 Total XP', value: formatNumber(newXp), inline: true }
        )
        .setColor(selectedOutcome.color)
        .setFooter({ text: 'The portal closes behind you as you return to your world.' });

    await message.edit({ embeds: [resultEmbed], components: [] });
}

async function studyPortal(message: any, player: any, portalType: string) {
    const studyXP = Math.floor(Math.random() * 100) + 50;
    
    await updatePlayer(player.discordId, {
        xp: player.xp + studyXP
    });

    const portalKnowledge = getPortalKnowledge(portalType);

    const studyEmbed = new EmbedBuilder()
        .setTitle('📚 Portal Analysis Complete')
        .setDescription('You carefully study the portal and gain valuable knowledge!')
        .addFields(
            { name: '🔍 Portal Type', value: portalType, inline: true },
            { name: '⭐ XP Gained', value: `${studyXP}`, inline: true },
            { name: '📖 Knowledge Gained', value: portalKnowledge, inline: false }
        )
        .setColor(0x4169e1)
        .setFooter({ text: 'Knowledge is power, and power opens new possibilities!' });

    await message.edit({ embeds: [studyEmbed], components: [] });
}

function getActivePortals() {
    // In a real implementation, this would track active portals per server
    return [
        { type: 'Fantasy Realm', emoji: '🏰' },
        { type: 'Cyberpunk City', emoji: '🌃' },
        { type: 'Ancient Ruins', emoji: '🏛️' }
    ];
}

function getPortalKnowledge(portalType: string): string {
    const knowledge: Record<string, string> = {
        'Fantasy Realm': 'This world operates on magical principles. Dragons are real and magic users are common.',
        'Cyberpunk City': 'A technologically advanced world where corporations rule and cybernetic enhancements are normal.',
        'Ancient Ruins': 'The remnants of an ancient civilization with advanced knowledge of dimensional travel.',
        'Magical Academy': 'A world dedicated to magical education where knowledge is the highest currency.',
        'Demon Realm': 'A dangerous dimension filled with powerful demons and chaotic energy.',
        'Sky Kingdom': 'A realm of floating islands where beings have mastered flight and air magic.'
    };

    return knowledge[portalType] || 'This portal leads to an unknown dimension with mysterious properties.';
}

export default command;
