import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../types.js';
import { getPlayer, updatePlayer } from '../../utils/database.js';
import { formatNumber } from '../../utils/helpers.js';

const command: Command = {
    name: 'daily',
    description: 'Claim your daily reward',
    usage: '$daily',
    category: 'economy',
    async execute(message, args) {
        const player = await getPlayer(message.author.id);
        if (!player) {
            return message.reply('❌ You need to start your RPG journey first! Use `$startrpg` to begin.');
        }

        const now = new Date();
        const lastDaily = player.lastDaily ? new Date(player.lastDaily) : null;

        // Check if player can claim daily reward
        if (lastDaily) {
            const timeSinceLastDaily = now.getTime() - lastDaily.getTime();
            const hoursRemaining = 24 - Math.floor(timeSinceLastDaily / (1000 * 60 * 60));

            if (hoursRemaining > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('⏰ Daily Reward Not Ready')
                    .setDescription(`You can claim your next daily reward in **${hoursRemaining} hours**!`)
                    .setColor(0xff8000)
                    .addFields({
                        name: '🕐 Next Claim Available',
                        value: `<t:${Math.floor((lastDaily.getTime() + 24 * 60 * 60 * 1000) / 1000)}:R>`,
                        inline: false
                    })
                    .setFooter({ text: 'Daily rewards reset every 24 hours!' });

                return message.reply({ embeds: [embed] });
            }
        }

        // Calculate daily reward based on level
        const baseGold = 100;
        const levelBonus = player.level * 10;
        const randomBonus = Math.floor(Math.random() * 50) + 1;
        const totalGold = baseGold + levelBonus + randomBonus;

        const baseXP = 50;
        const xpBonus = Math.floor(Math.random() * 20) + 10;
        const totalXP = baseXP + xpBonus;

        // Calculate streak bonus (simplified)
        let streakBonus = 1;
        if (lastDaily) {
            const daysDiff = Math.floor((now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff === 1) {
                // Continue streak
                streakBonus = Math.min(7, (player.level % 10) + 1);
            }
        }

        const finalGold = Math.floor(totalGold * streakBonus);
        const finalXP = Math.floor(totalXP * streakBonus);

        // Update player
        await updatePlayer(message.author.id, {
            gold: player.gold + finalGold,
            xp: player.xp + finalXP,
            lastDaily: now
        });

        // Check for special daily bonuses
        const specialRewards = [];
        
        // Weekend bonus
        if (now.getDay() === 0 || now.getDay() === 6) {
            specialRewards.push('🎉 Weekend Bonus: +50% rewards!');
        }

        // Level milestone bonus
        if (player.level % 10 === 0) {
            const milestoneBonus = player.level * 5;
            specialRewards.push(`🏆 Level ${player.level} Milestone: +${milestoneBonus} bonus gold!`);
        }

        // Random item reward (5% chance)
        if (Math.random() < 0.05) {
            specialRewards.push('📦 Lucky find: Random item added to inventory!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎁 Daily Reward Claimed!')
            .setDescription('You\'ve claimed your daily reward!')
            .addFields(
                { name: '💰 Gold Earned', value: formatNumber(finalGold), inline: true },
                { name: '⭐ XP Earned', value: formatNumber(finalXP), inline: true },
                { name: '🔥 Streak Multiplier', value: `x${streakBonus}`, inline: true },
                { name: '💵 New Balance', value: formatNumber(player.gold + finalGold), inline: true },
                { name: '📊 Total XP', value: formatNumber(player.xp + finalXP), inline: true },
                { name: '🕐 Next Claim', value: '<t:' + Math.floor((now.getTime() + 24 * 60 * 60 * 1000) / 1000) + ':R>', inline: true }
            )
            .setColor(0x00ff00)
            .setThumbnail(message.author.displayAvatarURL());

        if (specialRewards.length > 0) {
            embed.addFields({
                name: '🌟 Special Bonuses',
                value: specialRewards.join('\n'),
                inline: false
            });
        }

        embed.setFooter({ text: 'Come back tomorrow for another reward!' });

        await message.reply({ embeds: [embed] });
    }
};

export default command;
