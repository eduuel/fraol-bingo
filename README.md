# Beteseb Bingo — Telegram Bot

Telegram bingo gaming platform for [@betesebbingo_bot](https://t.me/betesebbingo_bot).

## Features

- User registration on `/start` with starter points
- Reply keyboard menus (Play, Balance, Invite, Instructions, BINGO)
- Create / join bingo games with shareable codes
- Auto-generated 5×5 BINGO cards (center free)
- Automatic number calling during live games
- Winner detection (rows, columns, diagonals)
- Points balance and game stats
- Referral links (`?start=ref_CODE`)
- Admin commands (`/admin`, `/addpoints`, `/broadcast`, etc.)

## Setup

1. Copy `.env.example` to `.env` and set `BOT_TOKEN` from [@BotFather](https://t.me/BotFather).
2. Set `ADMIN_IDS` to your Telegram user ID (numeric).
3. Install [MongoDB](https://www.mongodb.com/try/download/community) locally or use MongoDB Atlas and set `MONGODB_URI`.
4. Install and run:

```bash
npm install
npm start
```

## Player flow

1. `/start` — register and get menu
2. **🎮 Play** → **➕ Create Game** or **🔍 Join Game** (enter code)
3. Host taps **▶️ Start My Game** when enough players joined
4. Numbers are called every few seconds; cards auto-mark
5. Complete a line → **🏆 BINGO!** to claim the pot

## Admin commands

| Command | Description |
|---------|-------------|
| `/admin` | Show admin help |
| `/addpoints <id> <amount>` | Add points to user |
| `/setbalance <id> <amount>` | Set user balance |
| `/broadcast <message>` | Message all users |
| `/stats` | User and game counts |
| `/forcestart <code>` | Start a waiting game |
| `/makeadmin <id>` | Grant admin (env admins only) |

## Project structure

```
bot/bot.js          — entry point
config/             — env settings
models/             — User, Game (MongoDB)
services/           — bingo logic, games, users
handlers/           — Telegram command handlers
keyboards/          — reply keyboards
middleware/         — auto-register users
```
