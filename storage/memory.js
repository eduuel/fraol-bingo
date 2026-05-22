/** In-memory store (no MongoDB). Data resets when the bot restarts. */

const users = new Map();
const games = new Map();

function getUser(telegramId) {
  return users.get(telegramId) || null;
}

function saveUser(user) {
  users.set(user.telegramId, user);
  return user;
}

function getAllUsers() {
  return [...users.values()];
}

function findUserByReferralCode(code) {
  for (const u of users.values()) {
    if (u.referralCode === code) return u;
  }
  return null;
}

function getGame(code) {
  return games.get(String(code).toUpperCase()) || null;
}

function saveGame(game) {
  games.set(game.code, game);
  return game;
}

function gameCodeExists(code) {
  return games.has(String(code).toUpperCase());
}

function listGames(filter = () => true) {
  return [...games.values()].filter(filter);
}

function countGames(filter = () => true) {
  return listGames(filter).length;
}

module.exports = {
  getUser,
  saveUser,
  getAllUsers,
  findUserByReferralCode,
  getGame,
  saveGame,
  gameCodeExists,
  listGames,
  countGames,
};
