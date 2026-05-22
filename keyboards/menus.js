const { Markup } = require("telegraf");
const config = require("../config");

const contactRequestMenu = () =>
  Markup.keyboard([[Markup.button.contactRequest("📱 Share Phone Number")]])
    .resize()
    .oneTime();

const mainMenu = () =>
  Markup.keyboard([
    ["🎮 Play", "🏆 BINGO!"],
    ["💰 Balance", "💳 Deposit"],
    ["💸 Withdraw", "📖 Instructions"],
    ["📞 Support", "🔗 Invite"],
  ]).resize();

const playMenu = () =>
  Markup.keyboard([
    ["⚡ Quick Join", "➕ Create Room"],
    ["🔍 Join by Code", "📋 Open Rooms"],
    ["▶️ Start Game", "⬅️ Back"],
  ]).resize();

function depositAmountKeyboard() {
  const rows = [];
  const amounts = config.depositAmounts;

  for (let i = 0; i < amounts.length; i += 2) {
    const row = amounts.slice(i, i + 2).map((amt) =>
      Markup.button.callback(`${amt} Birr`, `deposit_amt:${amt}`)
    );
    rows.push(row);
  }

  rows.push([Markup.button.callback("❌ Cancel", "deposit_cancel")]);
  return Markup.inlineKeyboard(rows);
}

function stakeKeyboard() {
  const rows = [];
  const stakes = config.gameStakes;

  for (let i = 0; i < stakes.length; i += 2) {
    const row = stakes.slice(i, i + 2).map((amt) =>
      Markup.button.callback(`${amt} Birr`, `stake:${amt}`)
    );
    rows.push(row);
  }

  rows.push([Markup.button.callback("❌ Cancel", "stake_cancel")]);
  return Markup.inlineKeyboard(rows);
}

function withdrawAmountKeyboard(balance) {
  const rows = [];
  const amounts = config.withdrawAmounts.filter((a) => a <= balance);

  for (let i = 0; i < amounts.length; i += 2) {
    const row = amounts.slice(i, i + 2).map((amt) =>
      Markup.button.callback(`${amt} Birr`, `withdraw:${amt}`)
    );
    rows.push(row);
  }

  if (balance >= config.minWithdraw && !amounts.includes(balance)) {
    rows.push([
      Markup.button.callback(`All (${balance}) Birr`, `withdraw:${balance}`),
    ]);
  }

  rows.push([Markup.button.callback("❌ Cancel", "withdraw_cancel")]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
  mainMenu,
  contactRequestMenu,
  playMenu,
  depositAmountKeyboard,
  stakeKeyboard,
  withdrawAmountKeyboard,
};
