import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, getMarketListings, createMarketListing, updateMarketListing, updatePlayer } from '../../utils/database.js';
import { getItemById, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'auction',
    description: 'Participate in item auctions',
    usage: '$auction [create/bid/list]',
    category: 'economy',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const action = args[0]?.toLowerCase() || 'browse';

        switch (action) {
            case 'create':
                await handleCreateAuction(message, player, args.slice(1));
                break;
            case 'bid':
                await handleBidOnAuction(message, player, args.slice(1));
                break;
            case 'list':
                await handleMyAuctions(message, player);
                break;
            default:
                await handleBrowseAuctions(message, player);
                break;
        }
    }
};

async function handleBrowseAuctions(message: any, player: any) {
    const auctions = await getMarketListings(true); // Get auctions only
    
    if (auctions.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('🏛️ Auction House')
            .setDescription('No active auctions at the moment!')
            .setColor(0x8b4513)
            .addFields({
                name: '💡 Create an Auction',
                value: 'Use `$auction create <item_name> <starting_bid> <duration_hours>` to create an auction!',
                inline: false
            });

        return message.reply({ embeds: [embed] });
    }

    let currentPage = 0;
    const itemsPerPage = 3;
    const totalPages = Math.ceil(auctions.length / itemsPerPage);

    const generateEmbed = (page: number) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageAuctions = auctions.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle('🏛️ Auction House')
            .setDescription('Bid on exclusive items!')
            .setColor(0x8b4513)
            .setFooter({ text: `Page ${page + 1}/${totalPages} | Your Gold: ${formatNumber(player.gold)}` });

        for (const auction of pageAuctions) {
            const item = getItemById(auction.itemId);
            const itemName = item ? item.name : auction.itemName;
            const timeLeft = auction.expiresAt ? 
                Math.max(0, Math.floor((new Date(auction.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60))) : 0;
            
            const currentBidText = auction.currentBid ? 
                `${formatNumber(auction.currentBid)} Gold` : 
                `${formatNumber(auction.price)} Gold (Starting)`;
            
            const highestBidder = auction.highestBidder ? 
                auction.highestBidder.substring(0, 10) + '...' : 'No bids yet';

            embed.addFields({
                name: `🎯 ${itemName} x${auction.quantity}`,
                value: `**Current Bid:** ${currentBidText}\n**Highest Bidder:** ${highestBidder}\n**Time Left:** ${timeLeft}h\n**ID:** ${auction.id.substring(0, 8)}`,
                inline: false
            });
        }

        return embed;
    };

    const generateButtons = (page: number) => {
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('auction_prev')
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('auction_next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('auction_bid')
                    .setLabel('💰 Place Bid')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('auction_refresh')
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Primary)
            );
    };

    const response = await message.reply({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)]
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 120000
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();

        switch (interaction.customId) {
            case 'auction_prev':
                if (currentPage > 0) {
                    currentPage--;
                    await response.edit({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                }
                break;

            case 'auction_next':
                if (currentPage < totalPages - 1) {
                    currentPage++;
                    await response.edit({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                }
                break;

            case 'auction_bid':
                await interaction.followUp({
                    content: '💰 To place a bid, use `$auction bid <auction_id> <bid_amount>`\nYou can find the auction ID in the auction display.',
                    ephemeral: true
                });
                break;

            case 'auction_refresh':
                await interaction.followUp({
                    content: '🔄 Auction data refreshed!',
                    ephemeral: true
                });
                break;
        }
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function handleCreateAuction(message: any, player: any, args: string[]) {
    if (args.length < 3) {
        return message.reply('❌ Usage: `$auction create <item_name> <starting_bid> <duration_hours>`');
    }

    const durationHours = parseInt(args[args.length - 1]);
    const startingBid = parseInt(args[args.length - 2]);
    const itemName = args.slice(0, -2).join(' ');

    if (isNaN(startingBid) || startingBid <= 0) {
        return message.reply('❌ Please provide a valid starting bid!');
    }

    if (isNaN(durationHours) || durationHours < 1 || durationHours > 72) {
        return message.reply('❌ Duration must be between 1 and 72 hours!');
    }

    const inventory = JSON.parse(player.inventoryJson || '[]');
    const inventoryItem = inventory.find((item: any) => {
        const gameItem = getItemById(item.itemId);
        return gameItem && gameItem.name.toLowerCase().includes(itemName.toLowerCase());
    });

    if (!inventoryItem) {
        return message.reply('❌ You don\'t have that item in your inventory!');
    }

    const gameItem = getItemById(inventoryItem.itemId);
    if (!gameItem) {
        return message.reply('❌ Item not found!');
    }

    // Create auction
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    await createMarketListing({
        sellerId: player.discordId,
        itemId: gameItem.id,
        itemName: gameItem.name,
        price: startingBid,
        quantity: 1,
        isAuction: true,
        expiresAt: expiresAt
    });

    // Remove item from inventory
    inventoryItem.quantity -= 1;
    if (inventoryItem.quantity <= 0) {
        const index = inventory.indexOf(inventoryItem);
        inventory.splice(index, 1);
    }

    await updatePlayer(player.discordId, {
        inventoryJson: JSON.stringify(inventory)
    });

    const embed = new EmbedBuilder()
        .setTitle('🏛️ Auction Created!')
        .setDescription(`Your **${gameItem.name}** auction has been started!`)
        .setColor(0x00ff00)
        .addFields(
            { name: '📦 Item', value: gameItem.name, inline: true },
            { name: '💰 Starting Bid', value: formatNumber(startingBid), inline: true },
            { name: '⏰ Duration', value: `${durationHours} hours`, inline: true },
            { name: '🎯 Status', value: 'Active - Accepting Bids', inline: false }
        )
        .setFooter({ text: 'Players can now bid on your item!' });

    await message.reply({ embeds: [embed] });
}

async function handleBidOnAuction(message: any, player: any, args: string[]) {
    if (args.length < 2) {
        return message.reply('❌ Usage: `$auction bid <auction_id> <bid_amount>`');
    }

    const auctionId = args[0];
    const bidAmount = parseInt(args[1]);

    if (isNaN(bidAmount) || bidAmount <= 0) {
        return message.reply('❌ Please provide a valid bid amount!');
    }

    const auctions = await getMarketListings(true);
    const auction = auctions.find(a => a.id.startsWith(auctionId));

    if (!auction) {
        return message.reply('❌ Auction not found! Make sure you have the correct auction ID.');
    }

    if (auction.sellerId === player.discordId) {
        return message.reply('❌ You cannot bid on your own auctions!');
    }

    if (player.gold < bidAmount) {
        return message.reply(`❌ You don't have enough gold! You need ${formatNumber(bidAmount)} gold.`);
    }

    const currentHighestBid = auction.currentBid || auction.price;
    if (bidAmount <= currentHighestBid) {
        return message.reply(`❌ Your bid must be higher than the current bid of ${formatNumber(currentHighestBid)} gold!`);
    }

    // Update auction with new bid
    await updateMarketListing(auction.id, {
        currentBid: bidAmount,
        highestBidder: player.discordId
    });

    const embed = new EmbedBuilder()
        .setTitle('✅ Bid Placed!')
        .setDescription(`You placed a bid of ${formatNumber(bidAmount)} gold on **${auction.itemName}**!`)
        .setColor(0x00ff00)
        .addFields(
            { name: '📦 Item', value: auction.itemName, inline: true },
            { name: '💰 Your Bid', value: formatNumber(bidAmount), inline: true },
            { name: '🎯 Status', value: 'Highest Bidder', inline: true }
        )
        .setFooter({ text: 'You will be notified if you win the auction!' });

    await message.reply({ embeds: [embed] });
}

async function handleMyAuctions(message: any, player: any) {
    const allAuctions = await getMarketListings(true);
    const myAuctions = allAuctions.filter(a => a.sellerId === player.discordId);

    if (myAuctions.length === 0) {
        return message.reply('📦 You have no active auctions.');
    }

    const embed = new EmbedBuilder()
        .setTitle('🏛️ Your Auctions')
        .setDescription('Your active auctions:')
        .setColor(0x8b4513);

    for (const auction of myAuctions) {
        const timeLeft = auction.expiresAt ? 
            Math.max(0, Math.floor((new Date(auction.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60))) : 0;
        
        const currentBidText = auction.currentBid ? 
            `${formatNumber(auction.currentBid)} Gold` : 
            `${formatNumber(auction.price)} Gold (Starting)`;

        embed.addFields({
            name: `🎯 ${auction.itemName} x${auction.quantity}`,
            value: `**Current Bid:** ${currentBidText}\n**Time Left:** ${timeLeft}h\n**Status:** ${auction.currentBid ? 'Has Bids' : 'No Bids Yet'}`,
            inline: true
        });
    }

    await message.reply({ embeds: [embed] });
}

export default command;
