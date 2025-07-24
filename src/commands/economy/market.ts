import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, getMarketListings, createMarketListing, deleteMarketListing, updatePlayer } from '../../utils/database.js';
import { getItemById, formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'market',
    description: 'Browse player marketplace or list items for sale',
    usage: '$market [buy/sell/list]',
    category: 'economy',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const action = args[0]?.toLowerCase() || 'browse';

        switch (action) {
            case 'sell':
                await handleSellItem(message, player, args.slice(1));
                break;
            case 'list':
                await handleMyListings(message, player);
                break;
            case 'buy':
                await handleBuyItem(message, player, args.slice(1));
                break;
            default:
                await handleBrowseMarket(message, player);
                break;
        }
    }
};

async function handleBrowseMarket(message: any, player: any) {
    const listings = await getMarketListings(false); // Non-auction items
    
    if (listings.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('🏪 Player Market')
            .setDescription('The market is empty! Be the first to sell something.')
            .setColor(0x8b4513)
            .addFields({
                name: '💡 How to sell',
                value: 'Use `$market sell <item_name> <price>` to list an item for sale!',
                inline: false
            });

        return message.reply({ embeds: [embed] });
    }

    let currentPage = 0;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(listings.length / itemsPerPage);

    const generateEmbed = (page: number) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageListings = listings.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle('🏪 Player Market')
            .setDescription('Browse items sold by other players!')
            .setColor(0x8b4513)
            .setFooter({ text: `Page ${page + 1}/${totalPages} | Your Gold: ${formatNumber(player.gold)}` });

        for (const listing of pageListings) {
            const item = getItemById(listing.itemId);
            const itemName = item ? item.name : listing.itemName;
            const sellerName = listing.sellerId.substring(0, 10) + '...';
            
            embed.addFields({
                name: `💰 ${itemName} x${listing.quantity}`,
                value: `**Price:** ${formatNumber(listing.price)} Gold\n**Seller:** ${sellerName}\n**ID:** ${listing.id.substring(0, 8)}`,
                inline: true
            });
        }

        return embed;
    };

    const generateButtons = (page: number) => {
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('market_prev')
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('market_next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('market_buy')
                    .setLabel('💰 Buy Item')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('market_refresh')
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
            case 'market_prev':
                if (currentPage > 0) {
                    currentPage--;
                    await response.edit({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                }
                break;

            case 'market_next':
                if (currentPage < totalPages - 1) {
                    currentPage++;
                    await response.edit({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                }
                break;

            case 'market_buy':
                await interaction.followUp({
                    content: '💰 To buy an item, use `$market buy <listing_id>`\nYou can find the listing ID in the market display.',
                    ephemeral: true
                });
                break;

            case 'market_refresh':
                // Refresh listings
                const newListings = await getMarketListings(false);
                if (newListings.length !== listings.length) {
                    await interaction.followUp({
                        content: '🔄 Market refreshed! New items may be available.',
                        ephemeral: true
                    });
                }
                break;
        }
    });

    collector.on('end', () => {
        response.edit({ components: [] });
    });
}

async function handleSellItem(message: any, player: any, args: string[]) {
    if (args.length < 2) {
        return message.reply('❌ Usage: `$market sell <item_name> <price>`');
    }

    const price = parseInt(args[args.length - 1]);
    if (isNaN(price) || price <= 0) {
        return message.reply('❌ Please provide a valid price!');
    }

    const itemName = args.slice(0, -1).join(' ');
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

    // Create market listing
    await createMarketListing({
        sellerId: player.discordId,
        itemId: gameItem.id,
        itemName: gameItem.name,
        price: price,
        quantity: 1,
        isAuction: false
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
        .setTitle('✅ Item Listed!')
        .setDescription(`Your **${gameItem.name}** has been listed for ${formatNumber(price)} gold!`)
        .setColor(0x00ff00)
        .addFields(
            { name: '📦 Item', value: gameItem.name, inline: true },
            { name: '💰 Price', value: formatNumber(price), inline: true },
            { name: '🏪 Status', value: 'Listed on Market', inline: true }
        )
        .setFooter({ text: 'Other players can now buy your item!' });

    await message.reply({ embeds: [embed] });
}

async function handleBuyItem(message: any, player: any, args: string[]) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `$market buy <listing_id>`');
    }

    const listingId = args[0];
    const listings = await getMarketListings(false);
    const listing = listings.find(l => l.id.startsWith(listingId));

    if (!listing) {
        return message.reply('❌ Listing not found! Make sure you have the correct listing ID.');
    }

    if (listing.sellerId === player.discordId) {
        return message.reply('❌ You cannot buy your own items!');
    }

    if (player.gold < listing.price) {
        return message.reply(`❌ You need ${formatNumber(listing.price)} gold to buy this item! You only have ${formatNumber(player.gold)} gold.`);
    }

    // Process purchase
    const inventory = JSON.parse(player.inventoryJson || '[]');
    const existingItem = inventory.find((item: any) => item.itemId === listing.itemId);

    if (existingItem) {
        existingItem.quantity += listing.quantity;
    } else {
        inventory.push({
            itemId: listing.itemId,
            quantity: listing.quantity
        });
    }

    // Update buyer
    await updatePlayer(player.discordId, {
        gold: player.gold - listing.price,
        inventoryJson: JSON.stringify(inventory)
    });

    // Update seller (give them gold)
    const seller = await getPlayer(listing.sellerId);
    if (seller) {
        await updatePlayer(listing.sellerId, {
            gold: seller.gold + listing.price
        });
    }

    // Remove listing
    await deleteMarketListing(listing.id);

    const embed = new EmbedBuilder()
        .setTitle('✅ Purchase Successful!')
        .setDescription(`You bought **${listing.itemName}** for ${formatNumber(listing.price)} gold!`)
        .setColor(0x00ff00)
        .addFields(
            { name: '📦 Item Acquired', value: `${listing.itemName} x${listing.quantity}`, inline: true },
            { name: '💰 Gold Spent', value: formatNumber(listing.price), inline: true },
            { name: '💵 Remaining Gold', value: formatNumber(player.gold - listing.price), inline: true }
        );

    await message.reply({ embeds: [embed] });
}

async function handleMyListings(message: any, player: any) {
    const allListings = await getMarketListings(false);
    const myListings = allListings.filter(l => l.sellerId === player.discordId);

    if (myListings.length === 0) {
        return message.reply('📦 You have no items listed on the market.');
    }

    const embed = new EmbedBuilder()
        .setTitle('📦 Your Market Listings')
        .setDescription('Items you have listed for sale:')
        .setColor(0x8b4513);

    for (const listing of myListings) {
        embed.addFields({
            name: `💰 ${listing.itemName} x${listing.quantity}`,
            value: `**Price:** ${formatNumber(listing.price)} Gold\n**Listed:** ${listing.createdAt.toDateString()}\n**ID:** ${listing.id.substring(0, 8)}`,
            inline: true
        });
    }

    embed.setFooter({ text: 'Use $market remove <listing_id> to remove a listing' });

    await message.reply({ embeds: [embed] });
}

export default command;
