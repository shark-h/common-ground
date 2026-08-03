// The Daily Door — commitment generator.
//
// Runs once a day in CI with a secret seed (DAILY_SEED) that exists only in
// the repository's secret store. For today it publishes only the sha-256
// commitment of the day's door; for every past day it publishes the preimage
// (door + nonce), which any visitor's browser re-verifies against the hash
// that was committed before they picked.
//
// Everything is derived deterministically from the seed, so the action is
// idempotent and a lost workday changes nothing: choice and nonce are
// HMAC-SHA256(seed, date | purpose).
//
// Run: DAILY_SEED=... node make-day.mjs   (TODAY=YYYY-MM-DD overrides, for tests)

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOORS = 25;
const seed = process.env.DAILY_SEED;
if (!seed) { console.error("DAILY_SEED is not set"); process.exit(1); }

const here = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(here, "log.json");

const hmac = (msg) => crypto.createHmac("sha256", seed).update(msg).digest();

export function choiceFor(date) {
  // uniform over 0..24 via rejection sampling on the HMAC bytes
  const d = hmac(date + "|choice");
  const limit = 256 - (256 % DOORS);
  for (const b of d) if (b < limit) return b % DOORS;
  return d[0] % DOORS; // 32 bytes all >= 250 is ~impossible; keep total anyway
}

export function nonceFor(date) {
  return hmac(date + "|nonce").toString("hex").slice(0, 24);
}

export function commitFor(date) {
  const c = choiceFor(date), n = nonceFor(date);
  return crypto.createHash("sha256").update(`daily-${date}|${c}|${n}`).digest("hex");
}

export function utcToday() {
  return process.env.TODAY || new Date().toISOString().slice(0, 10);
}

export function buildLog(existing, today) {
  const days = new Map((existing.days || []).map((d) => [d.date, d]));
  if (!days.has(today)) days.set(today, { date: today, hash: commitFor(today) });
  for (const [date, day] of days) {
    if (date < today && day.choice == null) {
      day.choice = choiceFor(date);
      day.nonce = nonceFor(date);
    }
    // Never trust a stale hash: recompute so a corrupted file heals itself.
    day.hash = commitFor(date);
  }
  return { doors: DOORS, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const existing = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : {};
  const log = buildLog(existing, utcToday());
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1) + "\n");
  console.log(`log has ${log.days.length} day(s); today ${utcToday()} committed`);
}
