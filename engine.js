/*
 * Common Ground — engine
 *
 * A Schelling coordination game. Each round both players see the same
 * options and try to choose the same one. The machine models the human's
 * salience habits as a weight vector over option features, seeded with
 * folklore priors (people call heads; people meet at noon) and updated
 * after every reveal.
 *
 * Pure logic only — no DOM. Loaded by index.html and by test.mjs.
 */

const FEATURES = [
  "classic", // a culturally focal answer: heads, one, noon, the station clock
  "odd",     // categorically unlike its neighbours
  "center",  // spatially or ordinally the middle
  "proto",   // the most typical member of the category
  "first",   // first in reading order
  "last",    // last in reading order
  "extreme", // the largest / furthest / most
  "small",   // the least / minimal
  "alpha",   // alphabetically first
  "short",   // shortest label
  "long",    // longest label
];

// Folklore priors: how a stranger is likely to decide, before we know them.
const PRIORS = {
  classic: 2.2, odd: 1.4, center: 1.1, proto: 0.9, first: 0.7,
  last: 0.25, extreme: 0.5, small: 0.2, alpha: 0.3, short: 0.1, long: 0.1,
};

const LEARN_RATE = 0.6;
const W_MIN = -3, W_MAX = 4;

function newModel() {
  const w = {};
  for (const f of FEATURES) w[f] = PRIORS[f];
  return { w, rounds: 0 };
}

function score(model, option) {
  let s = 0;
  for (const f of option.f || []) s += model.w[f] ?? 0;
  return s;
}

// The machine's move: its best guess at what you will find salient.
// Deterministic given the model; ties break toward the earlier option,
// which is itself a defensible focal convention.
function machineChoice(model, round) {
  let best = 0, bestScore = -Infinity;
  round.options.forEach((opt, i) => {
    const s = score(model, opt);
    if (s > bestScore + 1e-9) { best = i; bestScore = s; }
  });
  return best;
}

// After the reveal: pull weights toward the features of what the human
// actually chose; on a miss, push away (half strength) from what the
// machine wrongly bet on.
function updateModel(model, round, userIdx, machineIdx) {
  const chosen = round.options[userIdx];
  for (const f of chosen.f || []) {
    model.w[f] = clamp(model.w[f] + LEARN_RATE);
  }
  if (userIdx !== machineIdx) {
    const bet = round.options[machineIdx];
    for (const f of bet.f || []) {
      model.w[f] = clamp(model.w[f] - LEARN_RATE * 0.5);
    }
  }
  model.rounds += 1;
  return model;
}

function clamp(x) { return Math.min(W_MAX, Math.max(W_MIN, x)); }

// What the model has come to believe about you, in words.
// Reported as movement away from the priors, not raw weight.
const HABIT_LINES = {
  odd:     "You go where the strange thing is.",
  center:  "You trust the middle.",
  classic: "You lean on the old signals — the coin, the noon, the number one.",
  first:   "You reach for the first thing you see.",
  last:    "You walk to the far end before you decide.",
  extreme: "You pick the most of whatever is on offer.",
  small:   "You choose the least thing, the quiet one.",
  proto:   "You take the most ordinary example and stand by it.",
  alpha:   "Some part of you is still alphabetizing.",
  short:   "You like the shortest word in the room.",
  long:    "You give the longest word the benefit of the doubt.",
};

function describeModel(model, limit = 3) {
  const moved = FEATURES
    .map((f) => ({ f, d: model.w[f] - PRIORS[f] }))
    .filter((x) => x.d > 0.55)
    .sort((a, b) => b.d - a.d)
    .slice(0, limit);
  return moved.map((x) => HABIT_LINES[x.f]);
}

// ---------------------------------------------------------------------------
// The twelve rounds. Curated, fixed order: folklore first (you both know the
// old signals), uniform fields later (where only the learned model helps).
// ---------------------------------------------------------------------------

const ROUNDS = [
  {
    id: "coin",
    prompt: "A coin is spinning. We both call it. Same call wins.",
    cols: 2,
    options: [
      { label: "heads", f: ["classic", "first"] },
      { label: "tails", f: ["last"] },
    ],
  },
  {
    id: "ten",
    prompt: "Pick a number from one to ten. Same number wins.",
    cols: 5,
    options: [
      { label: "1", f: ["classic", "first", "small"] },
      { label: "2", f: [] },
      { label: "3", f: [] },
      { label: "4", f: [] },
      { label: "5", f: ["center"] },
      { label: "6", f: [] },
      { label: "7", f: ["classic"] },
      { label: "8", f: [] },
      { label: "9", f: [] },
      { label: "10", f: ["last", "extreme"] },
    ],
  },
  {
    id: "hour",
    prompt: "Meet me tomorrow. We never agreed on a time.",
    cols: 5,
    options: [
      { label: "dawn", f: ["first"] },
      { label: "nine", f: [] },
      { label: "noon", f: ["classic", "center"] },
      { label: "dusk", f: [] },
      { label: "midnight", f: ["classic", "last", "extreme", "long"] },
    ],
  },
  {
    id: "doors",
    prompt: "Twenty-five doors. We each open one.",
    cols: 5,
    options: Array.from({ length: 25 }, (_, i) => ({
      label: "·",
      f: i === 12 ? ["center"] : i === 0 ? ["first"] : i === 24 ? ["last", "extreme"] : [],
    })),
  },
  {
    id: "flowers",
    prompt: "A field. We each stand by one plant.",
    cols: 5,
    options: [
      { label: "rose", f: ["classic", "proto"] },
      { label: "tulip", f: [] },
      { label: "daisy", f: ["alpha"] },
      { label: "orchid", f: ["long"] },
      { label: "fern", f: ["odd", "short"] },
    ],
  },
  {
    id: "letters",
    prompt: "One letter each.",
    cols: 5,
    options: [
      { label: "A", f: ["classic", "first", "alpha"] },
      { label: "E", f: ["proto"] },
      { label: "M", f: ["center"] },
      { label: "Q", f: ["odd"] },
      { label: "Z", f: ["last", "extreme"] },
    ],
  },
  {
    id: "primes",
    prompt: "Primes, mostly.",
    cols: 6,
    options: [
      { label: "2", f: ["first", "small"] },
      { label: "3", f: [] },
      { label: "5", f: ["center"] },
      { label: "7", f: ["classic"] },
      { label: "9", f: ["odd"] },
      { label: "11", f: ["last", "extreme", "long"] },
    ],
  },
  {
    id: "city",
    prompt: "A city neither of us has visited. Pick where to wait.",
    cols: 5,
    options: [
      { label: "the station", f: ["classic"] },
      { label: "the market", f: [] },
      { label: "the bridge", f: ["short"] },
      { label: "the fountain", f: ["center"] },
      { label: "the clock tower", f: ["classic", "last", "long"] },
    ],
  },
  {
    id: "colors",
    prompt: "Five doors, five colours.",
    cols: 5,
    options: [
      { label: "grey", f: ["first"] },
      { label: "blue", f: ["proto", "alpha"] },
      { label: "green", f: ["center"] },
      { label: "red", f: ["classic", "odd", "short"] },
      { label: "black", f: ["last", "extreme"] },
    ],
  },
  {
    id: "things",
    prompt: "No old signals here. Only what we've learned.",
    cols: 3,
    options: [
      { label: "moss", f: ["first", "small"] },
      { label: "river", f: [] },
      { label: "lantern", f: ["long"] },
      { label: "ash", f: ["alpha", "short"] },
      { label: "thread", f: [] },
      { label: "bell", f: ["last"] },
    ],
  },
  {
    id: "numbers",
    prompt: "Five numbers with nothing special about them. Almost.",
    cols: 5,
    options: [
      { label: "12", f: ["first", "small"] },
      { label: "29", f: [] },
      { label: "44", f: ["odd", "center"] },
      { label: "63", f: [] },
      { label: "87", f: ["last", "extreme"] },
    ],
  },
  {
    id: "end",
    prompt: "Last round. Where does this end?",
    cols: 2,
    options: [
      { label: "where we started", f: ["first", "long"] },
      { label: "here", f: ["classic", "center", "short"] },
      { label: "nowhere", f: ["odd"] },
      { label: "the next game", f: ["last"] },
    ],
  },
];

// Sealed commitment: the machine's choice is hashed with a nonce and shown
// before the human moves; the preimage is revealed and re-verified after.
async function commit(roundId, choiceIdx, nonce) {
  const data = new TextEncoder().encode(`${roundId}|${choiceIdx}|${nonce}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyCommit(roundId, choiceIdx, nonce, hash) {
  return (await commit(roundId, choiceIdx, nonce)) === hash;
}

const CommonGround = {
  FEATURES, PRIORS, ROUNDS,
  newModel, score, machineChoice, updateModel, describeModel,
  commit, verifyCommit,
};

if (typeof module !== "undefined" && module.exports) module.exports = CommonGround;
if (typeof window !== "undefined") window.CommonGround = CommonGround;
