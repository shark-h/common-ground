// Invariants for the Daily Door generator. Run: node test-daily.mjs
process.env.DAILY_SEED = "test-seed-not-the-real-one";
const { choiceFor, nonceFor, commitFor, buildLog } = await import("./make-day.mjs");
import crypto from "node:crypto";

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}`); if (!cond) failures++; };

// Determinism
check("choice is deterministic", choiceFor("2026-08-03") === choiceFor("2026-08-03"));
check("different days differ (usually)",
  new Set(["2026-08-03","2026-08-04","2026-08-05","2026-08-06"].map(choiceFor)).size >= 2);

// Range
{
  let ok = true;
  for (let i = 1; i <= 60; i++) {
    const c = choiceFor(`2026-09-${String(i % 28 + 1).padStart(2, "0")}|salt${i}`);
    if (c < 0 || c > 24 || !Number.isInteger(c)) ok = false;
  }
  check("choices always in 0..24", ok);
}

// Commitment matches the page's verification recipe
{
  const date = "2026-08-03";
  const recomputed = crypto.createHash("sha256")
    .update(`daily-${date}|${choiceFor(date)}|${nonceFor(date)}`).digest("hex");
  check("commit = sha256(daily-date|choice|nonce)", recomputed === commitFor(date));
}

// Log building: today sealed but not revealed; yesterday revealed
{
  const log = buildLog({ days: [{ date: "2026-08-02", hash: "stale" }] }, "2026-08-03");
  const y = log.days.find(d => d.date === "2026-08-02");
  const t = log.days.find(d => d.date === "2026-08-03");
  check("yesterday gets its reveal", y.choice === choiceFor("2026-08-02") && y.nonce === nonceFor("2026-08-02"));
  check("stale hash heals", y.hash === commitFor("2026-08-02"));
  check("today is committed", t.hash === commitFor("2026-08-03"));
  check("today is NOT revealed", t.choice == null && t.nonce == null);
}

// Idempotence
{
  const once = buildLog({}, "2026-08-03");
  const twice = buildLog(once, "2026-08-03");
  check("running twice changes nothing", JSON.stringify(once) === JSON.stringify(twice));
}

console.log(failures === 0 ? "\nall invariants hold" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
