const config = require("../config");

const MAX = config.maxBingoNumber;
const COL_SIZE = MAX / 5;

/** B-I-N-G-O columns for 1–600 (120 numbers each) */
const COLUMNS = [
  { letter: "B", min: 1, max: COL_SIZE },
  { letter: "I", min: COL_SIZE + 1, max: COL_SIZE * 2 },
  { letter: "N", min: COL_SIZE * 2 + 1, max: COL_SIZE * 3 },
  { letter: "G", min: COL_SIZE * 3 + 1, max: COL_SIZE * 4 },
  { letter: "O", min: COL_SIZE * 4 + 1, max: MAX },
];

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCard() {
  const grid = Array.from({ length: 5 }, () => Array(5).fill(0));
  const marks = Array.from({ length: 5 }, () => Array(5).fill(false));

  for (let c = 0; c < 5; c++) {
    const { min, max } = COLUMNS[c];
    const nums = new Set();
    while (nums.size < 5) {
      nums.add(randomInRange(min, max));
    }
    const colNums = [...nums];
    for (let r = 0; r < 5; r++) {
      grid[r][c] = colNums[r];
      marks[r][c] = false;
    }
  }

  grid[2][2] = 0;
  marks[2][2] = true;

  return { card: grid, marked: marks };
}

function numberToLetter(n) {
  for (const col of COLUMNS) {
    if (n >= col.min && n <= col.max) return col.letter;
  }
  return "?";
}

function formatCall(n) {
  return `${numberToLetter(n)} · ${n}`;
}

function markNumber(card, marked, number) {
  const next = marked.map((row) => [...row]);
  let hit = false;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (card[r][c] === number) {
        next[r][c] = true;
        hit = true;
      }
    }
  }

  return { marked: next, hit };
}

function checkBingo(marked) {
  const lines = [];

  for (let r = 0; r < 5; r++) {
    if (marked[r].every(Boolean)) lines.push(`row ${r + 1}`);
  }
  for (let c = 0; c < 5; c++) {
    if (marked.every((row) => row[c])) lines.push(`col ${c + 1}`);
  }
  if (marked.every((row, i) => row[i])) lines.push("diagonal ↘");
  if (marked.every((row, i) => row[4 - i])) lines.push("diagonal ↙");

  return lines;
}

function formatCard(card, marked) {
  const header = "    B      I      N      G      O";
  const rows = [header];

  for (let r = 0; r < 5; r++) {
    const cells = [];
    for (let c = 0; c < 5; c++) {
      let val = card[r][c];
      if (r === 2 && c === 2) val = "  ★ ";
      else if (marked[r][c]) val = `[${String(val).padStart(3)}]`;
      else val = ` ${String(val).padStart(3)} `;
      cells.push(val);
    }
    rows.push(cells.join(" "));
  }

  return "```\n" + rows.join("\n") + "\n```";
}

function pickNextNumber(calledNumbers) {
  const pool = [];
  for (let n = 1; n <= MAX; n++) {
    if (!calledNumbers.includes(n)) pool.push(n);
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateGameCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

module.exports = {
  MAX,
  COLUMNS,
  generateCard,
  numberToLetter,
  formatCall,
  markNumber,
  checkBingo,
  formatCard,
  pickNextNumber,
  generateGameCode,
};
