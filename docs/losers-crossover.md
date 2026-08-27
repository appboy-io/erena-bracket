# Losers-bracket crossover

## The problem

When the losers of winners round `r` drop into the losers bracket, *which seat*
each one takes decides how soon two players who already met in the winners
bracket can be forced together again. TOs and players call an early repeat
"double jeopardy": you lose to someone, and the same person knocks you out.

A winners round-`r` pair can meet again no earlier than losers round `2r` — the
loser needs LR(2r-2) and LR(2r-1) to come back around, and the winner does not
fall out of winners until round `r+1`, which drops into LR(2r). The crossover's
job is to push the meeting *past* that structural minimum wherever the geometry
allows.

## What went wrong

`tsl-1-marvel-tokon` (2026-08-22, 19 players in a 32 slot bracket). Lowry lost
to BlackVegeta in WR3M4, and met him again in LR6M1 — LR6 being exactly `2r` for
`r = 3`. The bracket was routed by an alternating rule (full reversal on even
winners rounds, half-swap on odd ones) which happened to leave the two halves of
each winners round feeding the same side of the losers bracket:

```
WR3M3 loser ─┐
WR3M4 loser ─┴→ LR4M1/M2 → LR5M1 → LR6M1
WR4M2 loser ───────────────────────→ LR6M1
```

`WR4M2` is `winner(WR3M3) vs winner(WR3M4)`, so LR6M1 always paired a WR3
half-two *loser* against a WR3 half-two *winner* — a coin flip on a rematch. It
came up rematch.

## The fix

`CROSSOVER_PLAN` in `src/double-elimination.ts` gives an explicit permutation per
drop round per bracket size, instead of an alternating rule. It was derived by
exhaustive search over four candidate permutations at every drop round —

| name       | effect                                |
|------------|---------------------------------------|
| `identity` | seat order unchanged                  |
| `reverse`  | last dropper takes the first seat     |
| `halfswap` | top and bottom halves trade places    |
| `revhalf`  | half-swap, then reversed              |

— ranked lexicographically so that rematches between players who met **early**
in winners get pushed back first. Those are the ones players notice; a repeat in
the losers final is unavoidable and nobody objects to it.

## Result

Slack per winners round `r`, meaning `(earliest possible losers rematch) - 2r`.
Higher is better; the last entry is always 0 because the losers final genuinely
cannot be made rematch-proof.

| bracket | old alternating rule | `CROSSOVER_PLAN` |
|---------|----------------------|------------------|
| 8       | `[1,0]`              | `[1,0]`          |
| 16      | `[2,0,0]`            | `[2,1,0]`        |
| 32      | `[3,1,0,0]`          | `[3,2,1,0]`      |
| 64      | `[4,2,1,0,0]`        | `[5,3,2,1,0]`    |
| 128     | `[4,2,2,1,0,0]`      | `[6,5,3,2,1,0]`  |
| 256     | `[4,2,2,2,1,0,0]`    | `[6,6,5,3,2,1,0]`|

For the Tokon bracket specifically, the earliest possible Lowry/BlackVegeta
rematch moves from LR6 to LR7.

## How good is this, exactly

Good enough to stop looking, at the sizes that matter.

`scripts/crossover-search.mjs` scores an arrangement with a bitmask model: "which
winners matches could the player arriving at this slot already have played" is a set
over winners matches, so it is a bitmask; a rematch is possible in a losers match iff
its two slot masks intersect; the winner of a losers match carries the union of its
two slots, since the winner is one of the two and either is reachable in some
play-out. That makes a full evaluation a few dozen bit operations.

Read the numbers as slack per winners round `r`: how many rounds LATER than the
structural minimum LR(2r) two players who met in WR `r` can first be re-paired.
Bigger is better.

| bracket | searched | best possible | `CROSSOVER_PLAN` |
|---------|----------|---------------|------------------|
| 16      | all 48 arrangements | `[2,1,0]` | `[2,1,0]` — optimal |
| 32      | all 1,935,360 (8!x4!x2!) | `[3,2,1,0]` | `[3,2,1,0]` — optimal, 640 ways tie |
| 64      | every 1- and 2-swap (15,376) | unknown | `[5,3,2,1,0]` — local optimum |
| 128     | every 1- and 2-swap (261,888) | unknown | `[6,5,3,2,1,0]` — local optimum |
| 256     | every 1- and 2-swap (4,328,160) | unknown | `[6,6,5,3,2,1,0]` — local optimum |

16 and 32 are settled outright: the whole permutation space was enumerated and the
shipped plan sits at the optimum. Above that, `16!` alone is about 2x10^13, so
exhaustive search is out; all that is proven there is that nothing within two swaps
improves on it.

**The last entry is always 0, and always will be.** Two players who met in the
winners bracket can always be forced together in the losers final. No static routing
escapes that — start.gg has the identical floor. The correct claim for this fix is
"rematches are pushed to the latest round the structure allows", never "rematches
cannot happen".

### A warning about the search itself

Random-restart hill climbing does not work here. At 64 it returns `[4,3,2,1,0]` —
worse than the plan already shipped — because a 16!-sized space traps steepest-ascent
in local optima. The `climb` mode is kept only so nobody rediscovers this the hard
way.

Two habits caught that. The model was made to reproduce all six previously-known
slack vectors before any new number from it was believed (`validate` mode, run it
first). And the climber was pointed at 32, where the answer was already proven, which
is what exposed it. Above k=5, seed the search FROM the shipped plan (`refine`) rather
than from random arrangements.

## When the losers bracket is seeded directly

A pools phase can send its runners-up straight into the losers bracket of the next
phase, which is what start.gg does with "Pools 2nd place and 3rd place". Those
entrants have to reduce down to the winners round-1 loser count before they can
merge with the drops, so the losers bracket gains entry rounds at the front and
then resumes the usual alternating merge/reduce.

`scripts/crossover-search.mjs entry <k> <L>` searches that shape exhaustively.
Numbers below are the earliest losers round in which two players who met in
winners round `r` can be re-paired — bigger is later is better. `99` means never.

| winners | direct into losers | best | worst |
|---------|--------------------|------|-------|
| 8       | 8                  | `[5,6,99]`   | `[4,6,99]` |
| 8       | 16                 | `[6,7,99]`   | `[5,7,99]` |
| 16      | 16                 | `[6,7,8,99]` | `[4,6,8,99]` |
| 16      | 32                 | `[7,8,9,99]` | `[5,7,9,99]` |

Three things follow.

**`CROSSOVER_PLAN` does not carry over.** It was derived for a losers bracket that
starts empty. These shapes have their own optima, so the plan gains a dimension:
keyed by (winners size, direct-entrant count), not by bracket size alone.

**Winners round 1 gains a permutation it does not otherwise have.** In a standard
bracket the round-1 losers are paired against each other on fixed geometry. Here
each one is merged against a surviving direct entrant, so which seat they take is a
free choice — and a consequential one.

**The choice is worth up to two rounds.** At 16 winners and 32 direct, the best
arrangement holds a winners round-1 rematch off until LR7; the worst allows it at
LR5. Picking arbitrarily gives away real separation.

Note the last column is always `99`: the winners-final pair can never meet again in
losers, because the winners-final winner goes to the grand final rather than down.
Their rematch, if it happens, is the grand final — which is the format working as
intended, not double jeopardy.

Pool rematches — two players who met in a POOL meeting again in the next phase —
are a separate class and are not modelled here. That is what start.gg's "avoid
previous matchups" toggle addresses.

## Keeping it honest

Two tests hold the line, both in `src/double-elimination.test.ts` and
`src/tokon-regression.test.ts`:

- `losers crossover is optimal` recomputes the slack vector for sizes 8–256 and
  asserts the table above. If someone edits `CROSSOVER_PLAN`, this fails.
- `tsl-1-marvel-tokon replay` rebuilds the real 19-player bracket from the
  arrangement that ran in production, replays the winners bracket exactly as it
  was played, then explores every possible losers-bracket outcome and asserts
  the pair cannot meet before LR7. Against the old routing it reports LR6M1 —
  the match that actually happened.

Above 512 players there is no searched plan and the code falls back to plain
reversal. Run `scripts/crossover-search.mjs` if that ever matters.

## Caveat

This is static routing decided at generation time, the same as start.gg. It
bounds how *early* a rematch can happen; it cannot guarantee none. Eliminating
them entirely would need pairings chosen when the feeding matches finish, which
is a different design.
