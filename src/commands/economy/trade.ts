import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { getItemById, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'trade',
    description: 'Trade items or gold with another player',
    usage: '$trade @user',
    category: 'economy',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ You need to mention a user to trade with! Usage: `$trade @user`');
        }

        if (target.id === message.author.id) {
            return message.reply('❌ You cannot trade with yourself!');
        }

        if (target.bot) {
            return message.reply('❌ You cannot trade with bots!');
        }

        const targetPlayer = await getPlayer(target.id);
        if (!targetPlayer) {
            return message.reply('❌ The target user has not started their RPG journey yet!');
        }

        // Initialize trade
        const embed = new EmbedBuilder()
            .setTitle('🤝 Trade Request')
            .setDescription(`${message.author} wants to trade with ${target}!`)
            .addFields(
                { name: `${message.author.username}'s Gold`, value: formatNumber(player.gold), inline: true },
                { name: `${target.username}'s Gold`, value: formatNumber(targetPlayer.gold), inline: true },
                { name: '⚠️ Trade Rules', value: 'Both players must accept the trade terms.\nTrades are final once accepted!', inline: false }
            )
            .setColor(0x8b4513)
            .setFooter({ text: 'The other player has 60 seconds to respond.' });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('trade_accept')
                    .setLabel('✅ Accept Trade')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('trade_decline')
                    .setLabel('❌ Decline Trade')
                    .setStyle(ButtonStyle.Danger)
            );

        const response = await message.reply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === target.id,
            time: 60000
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();

            if (interaction.customId === 'trade_accept') {
                // Start trade setup
                await startTradeSetup(response, message.author, target, player, targetPlayer);
            } else {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('❌ Trade Declined')
                    .setDescription(`${target.username} declined the trade request.`)
                    .setColor(0xff0000);

                await response.edit({ embeds: [declineEmbed], components: [] });
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Trade Expired')
                    .setDescription('The trade request expired due to no response.')
                    .setColor(0x808080);

                response.edit({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
};

async function startTradeSetup(message: any, user1: any, user2: any, player1: any, player2: any) {
    const tradeState = {
        user1Offer: { gold: 0, items: [] as any[] },
        user2Offer: { gold: 0, items: [] as any[] },
        user1Ready: false,
        user2Ready: false
    };

    const generateTradeEmbed = () => {
        const embed = new EmbedBuilder()
            .setTitle('🤝 Trade Setup')
            .setDescription('Configure your trade offers:')
            .addFields(
                { 
                    name: `${user1.username}'s Offer ${tradeState.user1Ready ? '✅' : '⏳'}`,
                    value: `**Gold:** ${formatNumber(tradeState.user1Offer.gold)}\n**Items:** ${tradeState.user1Offer.items.length || 'None'}`,
                    inline: true 
                },
                { 
                    name: `${user2.username}'s Offer ${tradeState.user2Ready ? '✅' : '⏳'}`,
                    value: `**Gold:** ${formatNumber(tradeState.user2Offer.gold)}\n**Items:** ${tradeState.user2Offer.items.length || 'None'}`,
                    inline: true 
                },
                {
                    name: '📋 Instructions',
                    value: 'Use the buttons to add gold or items to your offer.\nBoth players must mark ready to complete the trade.',
                    inline: false
                }
            )
            .setColor(0x8b4513);

        return embed;
    };

    const generateTradeButtons = () => {
        return [
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('trade_add_gold_1')
                        .setLabel(`${user1.username}: Add Gold`)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('trade_add_item_1')
                        .setLabel(`${user1.username}: Add Item`)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('trade_ready_1')
                        .setLabel(`${user1.username}: ${tradeState.user1Ready ? 'Unready' : 'Ready'}`)
                        .setStyle(tradeState.user1Ready ? ButtonStyle.Success : ButtonStyle.Danger)
                ),
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('trade_add_gold_2')
                        .setLabel(`${user2.username}: Add Gold`)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('trade_add_item_2')
                        .setLabel(`${user2.username}: Add Item`)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('trade_ready_2')
                        .setLabel(`${user2.username}: ${tradeState.user2Ready ? 'Unready' : 'Ready'}`)
                        .setStyle(tradeState.user2Ready ? ButtonStyle.Success : ButtonStyle.Danger)
                )
        ];
    };

    await message.edit({
        embeds: [generateTradeEmbed()],
        components: generateTradeButtons()
    });

    const tradeCollector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === user1.id || i.user.id === user2.id,
        time: 300000 // 5 minutes
    });

    tradeCollector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        const isUser1 = interaction.user.id === user1.id;
        const currentPlayer = isUser1 ? player1 : player2;
        const currentOffer = isUser1 ? tradeState.user1Offer : tradeState.user2Offer;

        if (interaction.customId.includes('add_gold')) {
            // Simple gold offer (simplified for demo)
            const goldAmount = Math.min(1000, Math.floor(currentPlayer.gold * 0.1));
            currentOffer.gold = goldAmount;
            
            await interaction.followUp({
                content: `💰 Added ${formatNumber(goldAmount)} gold to your offer!`,
                ephemeral: true
            });
        } else if (interaction.customId.includes('add_item')) {
            await interaction.followUp({
                content: '📦 Item trading feature coming soon!',
                ephemeral: true
            });
        } else if (interaction.customId.includes('ready')) {
            if (isUser1) {
                tradeState.user1Ready = !tradeState.user1Ready;
            } else {
                tradeState.user2Ready = !tradeState.user2Ready;
            }

            // Check if both players are ready
            if (tradeState.user1Ready && tradeState.user2Ready) {
                await executeTrade(message, user1, user2, player1, player2, tradeState);
                return;
            }
        }

        await message.edit({
            embeds: [generateTradeEmbed()],
            components: generateTradeButtons()
        });
    });

    tradeCollector.on('end', (collected) => {
        if (!tradeState.user1Ready || !tradeState.user2Ready) {
            const cancelEmbed = new EmbedBuilder()
                .setTitle('❌ Trade Cancelled')
                .setDescription('Trade was cancelled or expired.')
                .setColor(0xff0000);

            message.edit({ embeds: [cancelEmbed], components: [] });
        }
    });
}

async function executeTrade(message: any, user1: any, user2: any, player1: any, player2: any, tradeState: any) {
    try {
        // Execute the trade
        await updatePlayer(player1.discordId, {
            gold: player1.gold - tradeState.user1Offer.gold + tradeState.user2Offer.gold
        });

        await updatePlayer(player2.discordId, {
            gold: player2.gold - tradeState.user2Offer.gold + tradeState.user1Offer.gold
        });

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Trade Completed!')
            .setDescription('The trade has been successfully completed!')
            .addFields(
                { 
                    name: `${user1.username} Received`,
                    value: `**Gold:** ${formatNumber(tradeState.user2Offer.gold)}`,
                    inline: true 
                },
                { 
                    name: `${user2.username} Received`,
                    value: `**Gold:** ${formatNumber(tradeState.user1Offer.gold)}`,
                    inline: true 
                }
            )
            .setColor(0x00ff00)
            .setFooter({ text: 'Trade completed successfully!' });

        await message.edit({ embeds: [successEmbed], components: [] });

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Trade Failed')
            .setDescription('An error occurred while processing the trade.')
            .setColor(0xff0000);

        await message.edit({ embeds: [errorEmbed], components: [] });
    }
}

export default command;
