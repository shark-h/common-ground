// Invariant tests for the Common Ground engine. Run: node test.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const CG = require("./engine.js");

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failures++;
}

// --- Data integrity -------------------------------------------------------
check("twelve rounds", CG.ROUNDS.length === 12);
check("all round ids unique", new Set(CG.ROUNDS.map(r => r.id)).size === CG.ROUNDS.length);
check(
  "every option feature is a known feature",
  CG.ROUNDS.every(r => r.options.every(o => (o.f || []).every(f => CG.FEATURES.includes(f))))
);
check(
  "every round has at least two options",
  CG.ROUNDS.every(r => r.options.length >= 2)
);
check(
  "no round is featureless (machine would tie-break blindly everywhere)",
  CG.ROUNDS.every(r => r.options.some(o => (o.f || []).length > 0))
);

// --- Determinism ----------------------------------------------------------
{
  const m1 = CG.newModel(), m2 = CG.newModel();
  const same = CG.ROUNDS.every(r => CG.machineChoice(m1, r) === CG.machineChoice(m2, r));
  check("machine choice is deterministic given the model", same);
}

// --- Folklore priors point at the folklore answers -------------------------
{
  const m = CG.newModel();
  const coin = CG.ROUNDS.find(r => r.id === "coin");
  check("fresh model calls heads", coin.options[CG.machineChoice(m, coin)].label === "heads");
  const hour = CG.ROUNDS.find(r => r.id === "hour");
  check("fresh model meets at noon", hour.options[CG.machineChoice(m, hour)].label === "noon");
}

// --- Learning moves toward the human --------------------------------------
{
  const m = CG.newModel();
  const doors = CG.ROUNDS.find(r => r.id === "doors");
  const centerBefore = m.w.center;
  CG.updateModel(m, doors, 12, CG.machineChoice(m, doors));
  check("weights move toward the chosen option's features", m.w.center > centerBefore);
}

// --- A consistent human becomes predictable --------------------------------
// Simulated player who always takes the odd one out when there is one,
// otherwise the last option. Play three full games with a persistent model;
// the machine's match rate must improve from game 1 to game 3.
{
  const m = CG.newModel();
  const oddPlayer = (round) => {
    const i = round.options.findIndex(o => (o.f || []).includes("odd"));
    return i >= 0 ? i : round.options.length - 1;
  };
  const playGame = () => {
    let matches = 0;
    for (const r of CG.ROUNDS) {
      const machine = CG.machineChoice(m, r);
      const user = oddPlayer(r);
      if (machine === user) matches++;
      CG.updateModel(m, r, user, machine);
    }
    return matches;
  };
  const g1 = playGame(); playGame(); const g3 = playGame();
  check(`machine learns a consistent player (game1=${g1}, game3=${g3})`, g3 > g1);
  check("learned model prefers oddity over folklore", m.w.odd > m.w.classic);
}

// --- Weights stay bounded ---------------------------------------------------
{
  const m = CG.newModel();
  const r = CG.ROUNDS.find(x => x.id === "flowers");
  for (let i = 0; i < 200; i++) CG.updateModel(m, r, 4, 0);
  const bounded = CG.FEATURES.every(f => m.w[f] >= -3 && m.w[f] <= 4);
  check("200 one-sided updates stay within [-3, 4]", bounded);
}

// --- Sealed commitment ------------------------------------------------------
{
  const hash = await CG.commit("coin", 0, "nonce-abc");
  check("commit produces a sha-256 hex digest", /^[0-9a-f]{64}$/.test(hash));
  check("verify accepts the true preimage", await CG.verifyCommit("coin", 0, "nonce-abc", hash));
  check("verify rejects a different choice", !(await CG.verifyCommit("coin", 1, "nonce-abc", hash)));
  check("verify rejects a different nonce", !(await CG.verifyCommit("coin", 0, "nonce-xyz", hash)));
}

// --- Self-description -------------------------------------------------------
{
  const m = CG.newModel();
  check("a fresh model claims nothing about you", CG.describeModel(m).length === 0);
  const r = CG.ROUNDS.find(x => x.id === "flowers");
  for (let i = 0; i < 4; i++) CG.updateModel(m, r, 4, CG.machineChoice(m, r));
  check("a trained model has something to say", CG.describeModel(m).length > 0);
}

console.log(failures === 0 ? "\nall invariants hold" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
