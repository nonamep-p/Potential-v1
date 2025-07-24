import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer } from '../../utils/database.js';
import { formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'balance',
    description: 'Check your gold balance',
    usage: '$balance [@user]',
    category: 'economy',
    async execute(message, args) {
        let targetUser = message.author;
        
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first()!;
        }

        const player = await getPlayer(targetUser.id);
        if (!player) {
            const errorMsg = targetUser.id === message.author.id 
                ? 'You need to start your RPG journey first! Use `$startrpg` to begin.'
                : 'This user has not started their RPG journey yet.';
            return message.reply(`❌ ${errorMsg}`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`💰 ${player.username}'s Balance`)
            .setDescription(`**${formatNumber(player.gold)}** Gold`)
            .setColor(0xffd700)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: '💵 Current Gold', value: formatNumber(player.gold), inline: true },
                { name: '📊 Wealth Rank', value: 'Coming Soon', inline: true },
                { name: '💎 Net Worth', value: 'Coming Soon', inline: true }
            )
            .setFooter({ text: 'Earn gold through battles, work, daily rewards, and trading!' });

        // Add wealth status based on gold amount
        let wealthStatus = '';
        if (player.gold >= 1000000) {
            wealthStatus = '👑 Millionaire';
        } else if (player.gold >= 100000) {
            wealthStatus = '💎 Wealthy';
        } else if (player.gold >= 10000) {
            wealthStatus = '💰 Rich';
        } else if (player.gold >= 1000) {
            wealthStatus = '🪙 Comfortable';
        } else if (player.gold >= 100) {
            wealthStatus = '💵 Getting By';
        } else {
            wealthStatus = '🪙 Poor';
        }

        embed.addFields({
            name: '📈 Wealth Status',
            value: wealthStatus,
            inline: false
        });

        await message.reply({ embeds: [embed] });
    }
};

export default command;
