# Double-Elimination Losers Bracket Routing — Rematch Avoidance

**Date:** 2026-07-08
**Status:** Approved design, pending implementation plan
**Project:** `erena-bracket` (pure bracket-generation library, consumed by `erena-web`)

## Problem

In Erena's double-elimination brackets, a player can be knocked out by the **same opponent twice in a row** — losing to them in the winners bracket, then immediately re-facing them in the losers bracket. TOs call this "double jeopardy"; start.gg does not have it.

Confirmed against the live prod tournament `g-league-dbfz-2026-tsl`:

- **WB R1M2:** `xhkkjt` vs `f3xarj` → `f3xarj` wins; `xhkkjt` drops to losers (LR1M1).
- **WB R2M1:** `gp18yf` vs `f3xarj` → `f3xarj` loses; drops to **LR2M1**.
- **LR2M1:** `xhkkjt` vs `f3xarj` again → `xhkkjt` is eliminated by the player who already beat them in winners.

## Root Cause

`src/double-elimination.ts` → `linkWinnersToLosers`. For drop-in rounds (WB round ≥ 2) it maps the loser of `WR{r}M{i}` straight down to `LR{2r-2}M{i}` via `losersMatchIndex = i` — no crossover. That LB match's other slot is fed (through `LR{2r-3}`) by the *same* WB R1 pair that `WR{r}M{i}` itself came from, so the dropped player can meet someone they already played.

The WB R1 → LB R1 mapping (`losersMatchIndex = floor(i/2)`, two WB matches into one LB match) is fine and unchanged. The defect is only the drop-in mapping for WB round ≥ 2.

## Goal

Newly generated double-elimination brackets route WB losers into the LB using the **standard alternating crossover**, so that **no two players who have already met can be paired again in the losers bracket until it is mathematically forced** (losers semifinals, per standard double-elim). This matches start.gg's observable behavior.

## Non-Goals

- **No repair or migration of existing brackets.** Already-generated brackets (including live `g-league-dbfz-2026-tsl`) keep their baked-in `loserNextMatchId` pointers. (User decision.)
- **No backend progression changes.** `erena-backend` progression simply follows the generated `loserNextMatchId`/`loserNextMatchSlot` pointers; correcting generation is sufficient.
- **No change** to winners-bracket structure, losers-bracket round counts, bye handling, or grand-final logic — only the WB→LB drop mapping for drop-in rounds.

## Design

### The routing change

Replace the straight `losersMatchIndex = i` mapping in `linkWinnersToLosers` (drop-in rounds, WB round ≥ 2) with the standard **alternating crossover**: for each drop-in round, the WB losers are placed into that round's LB drop-in matches in an order that alternates per round (full reversal / half-rotation), so a dropped player always meets an opponent from a *different* WB sub-bracket than their own.

```
Today (straight, buggy):              Fixed (crossover):
 WR2M1 loser → LR2M1                   WR2M1 loser → LR2M4   (opposite side)
 WR2M2 loser → LR2M2                   WR2M2 loser → LR2M3
 WR2M3 loser → LR2M3                   WR2M3 loser → LR2M2
 WR2M4 loser → LR2M4                   WR2M4 loser → LR2M1
```

Rather than reverse-engineer start.gg's internal indices (not verifiable), the exact per-round pattern is **derived test-first against the correctness invariant below**. The implementation adjusts only the computed `losersMatchIndex` (and, where a round's drop matches occupy slot 1 vs slot 2, the slot) — the surrounding structure, IDs, and counts are untouched.

### Correctness invariant

Correctness is **structural**, not outcome-dependent (the routing is deterministic and independent of who wins):

> For every losers-bracket match, trace the set of winners-bracket matches that can feed each of its two slots (its "WB ancestry"). The two slots' WB ancestries must be **disjoint** — until the point in the bracket where a rematch is mathematically unavoidable (the final losers rounds).

If two slots of an LB match share a WB match in their ancestry, the two players in that LB match could be the two players who already met in that shared WB match → double jeopardy. Disjoint ancestries prove it cannot happen.

### Components / files

- **Modify:** `src/double-elimination.ts` → `linkWinnersToLosers` (drop-in mapping only).
- **Add tests:** `src/double-elimination.test.ts` — the invariant test plus explicit regression tests.

## Testing — two layers

### Layer 1 (primary, definitive, no deploy): property/structural tests in `erena-bracket`

- **Invariant test:** for bracket sizes **4, 8, 16, 32** (and a bye-heavy 32-with-17-players case mirroring g-league), generate the bracket and assert the WB-ancestry-disjointness invariant for every losers-bracket match up to the forced-rematch boundary.
- **Regression test:** reproduce the g-league scenario structurally — assert the loser of `WR2M1` is *not* routed into the LB match fed by `WR1M1`/`WR1M2`.
- The routing is a pure function, so these run in milliseconds and exhaustively cover every size. **This is the source of truth for correctness.**

### Layer 2 (real-environment smoke test): beta

Confirms the deployed build uses the new lib and generate→store→render works end-to-end:

1. Push the `erena-bracket` fix branch.
2. In `erena-web`: `npm install erena-bracket@github:appboy-io/erena-bracket#<branch>` to bump the **locked commit** in `package-lock.json` (without this, beta's `npm ci` reinstalls the old commit and the rebuild is a no-op). Commit + push the erena-web branch.
3. Beta rebuilds the frontend, picking up the new `erena-bracket`.
4. Generate a fresh test tournament on beta; run a small script that reads its match records from beta PB and applies the same invariant check to the real generated data.

## Rollout

1. `erena-bracket`: implement + tests on `fix/losers-bracket-double-jeopardy`, push.
2. Merge to `erena-bracket` default branch (so the loose `github:appboy-io/erena-bracket` pin resolves to it).
3. `erena-web`: bump the locked `erena-bracket` commit, push branch → beta rebuild → Layer 2 smoke test.
4. Existing brackets are intentionally left untouched.
