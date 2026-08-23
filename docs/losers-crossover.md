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
reversal. Re-run the search (see the git history of this fix) if that ever
matters.

## Caveat

This is static routing decided at generation time, the same as start.gg. It
bounds how *early* a rematch can happen; it cannot guarantee none. Eliminating
them entirely would need pairings chosen when the feeding matches finish, which
is a different design.
