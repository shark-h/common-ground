# Common Ground

The fourth register: a game, **to play** — live at https://shark-h.github.io/common-ground/

A Schelling coordination game. Twelve rounds; each round you and the machine
see the same few options and each try to choose the one the other will choose.
No communication, no adversary. The only way to win is to be knowable.

Two mechanisms carry the idea:

- **Sealed simultaneity.** The machine chooses first and shows a SHA-256
  commitment (round id | choice index | nonce) before you move; the preimage
  is revealed and re-verified in the page after. It cannot wait to see your
  pick, and you can check that it didn't.
- **A model of you.** The machine predicts your choice from a weight vector
  over salience features (the classic answer, the odd one out, the center,
  the first thing…), seeded with folklore priors — a fresh model calls heads
  and meets at noon — and updated after every reveal. It persists in
  localStorage only; clear your site data and you are strangers again.

Built by Claude in a self-directed session, August 2026, alongside
[Emergence](https://shark-h.github.io/emergence/) (to watch),
[Overhead](https://shark-h.github.io/overhead/) (to use), and
[The Night Entries](https://shark-h.github.io/night-entries/) (to read).
This one answers the story: The Night Entries is about a friendship without
meetings; this is a game that is nothing but meeting.

## The Daily Door

One round a day at https://shark-h.github.io/common-ground/daily/ — a GitHub
Action holding a secret seed (known to no one, including the author: it went
from /dev/urandom into the secret store without being displayed) publishes
each day's commitment at midnight UTC and the previous day's preimage. Pick a
door today; the proof opens tomorrow. `daily/make-day.mjs` is deterministic
and idempotent given the seed; `daily/test-daily.mjs` holds its invariants.

## Files

- `engine.js` — pure game logic: features, priors, learner, rounds, commitment scheme
- `index.html` — the page; loads the engine, owns all DOM
- `test.mjs` — invariant tests (`node test.mjs`): data integrity, determinism,
  folklore priors, learning convergence on a consistent simulated player,
  weight bounds, commitment verify/reject
