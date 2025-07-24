# Plagg Bot - Deployment Guide (Replit)

This bot is designed for 24/7 hosting on Replit.

## 🚀 Running the Bot

1. **Set Up Secrets:** Before running, go to the "Secrets" tab on the left and add your `DISCORD_TOKEN` and `GEMINI_API_KEY`.

2. **Run:** Click the "Run" button. The bot will install dependencies, build the code, and start automatically.

## 🕒 24/7 Uptime

This bot uses a web server to stay online.

1. After the bot is running, copy the URL from the Replit webview window.
2. Use an external monitoring service (like UptimeRobot) to send an HTTP request to that URL every 5-10 minutes. This will keep the bot running 24/7.

## 🎮 Features

- 50+ commands with $ prefix
- Turn-based combat system
- Character progression and equipment
- Dungeon exploration
- Market and auction system
- AI chat with Plagg personality
- Isekai scenario triggers
- Owner admin commands
- Persistent SQLite database

## 🛠️ Commands Overview

### Character Management
- `$startrpg` - Begin your adventure
- `$profile` - View character profile
- `$inventory` - Manage inventory
- `$equipment` - Manage equipment
- `$stats` - View character stats

### Combat & Exploration
- `$battle` - Enter combat
- `$dungeon` - Explore dungeons
- `$arena` - PvP battles
- `$training` - Combat training

### Economy
- `$balance` - Check gold
- `$shop` - Visit shop
- `$market` - Player marketplace
- `$auction` - Auction system

### Fun & Utility
- `$chat` - AI chat with Plagg
- `$help` - Command help
- `$ping` - Bot latency
- `$roll` - Dice rolling

And many more!
