# Double-Elimination Losers Routing (Rematch Avoidance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `erena-bracket` so newly generated double-elimination brackets route winners-bracket losers into the losers bracket with a crossover, eliminating the "double jeopardy" immediate rematch (confirmed on prod `g-league-dbfz-2026-tsl`).

**Architecture:** The defect is in `linkWinnersToLosers` (drop-in mapping for WB round ≥ 2 uses a straight `losersMatchIndex = i`). Replace it with an **ancestry-disjoint assignment**: when a WB round-r loser drops into the losers bracket, assign it to a losers match whose sitting player (slot 1) traces back to a *different* set of winners-bracket matches — so the two never met before. Correctness is proven by an independent structural invariant test, not by copying start.gg's indices.

**Tech Stack:** TypeScript, vitest. Pure library (no runtime deps). Consumed by `erena-web` as a git dependency that serves committed `dist/`.

**Branch:** `fix/losers-bracket-double-jeopardy` (already created in `erena-bracket`; spec committed).

---

## Key facts the implementer must know

- **Losers-bracket structure** (in `generateLosersBracket`): losers rounds = `(winnersRounds-1)*2`. Odd LB rounds are "fresh" merges; even LB rounds are where WB round-r losers drop in. A WB round-r loser (r ≥ 2) drops into LB round `2r-2` as **slot 2**; that LB match's **slot 1** is the surviving player advancing from the previous LB round. WB round-1 losers fill LB round 1 (two WB matches → one LB match, slots 1 and 2) — this mapping is correct and must not change.
- **The final drop is forced:** the WB *finals* loser (WB round `winnersRounds`) drops into the LB final — a rematch there is mathematically unavoidable and is handled by a separate block at the end of `linkWinnersToLosers`. The invariant applies only to WB rounds `2 .. winnersRounds-1`.
- **`dist/` is committed and served to consumers.** After changing `src/`, you MUST `npm run build` and commit `dist/`, or `erena-web` will keep running the old code.
- Tests run with `npm test` (vitest). Participants helper `createParticipants(count)` already exists in the test file.

## File Structure

- **Modify:** `src/double-elimination.ts` — add a private `winnersAncestry` helper; replace the drop-in mapping (WB round ≥ 2) in `linkWinnersToLosers`.
- **Modify (tests):** `src/double-elimination.test.ts` — add an independent ancestry tracer + invariant assertion, RED test, size matrix, and g-league regression.
- **Rebuild:** `dist/` (compiled output, committed).
- **Rollout (separate repo):** `erena-web/package.json` + `package-lock.json` — bump the locked `erena-bracket` commit.

---

## Task 1: Failing invariant test (RED)

**Files:**
- Test: `src/double-elimination.test.ts`

- [ ] **Step 1: Add an independent ancestry tracer + invariant assertion at the top of the test file** (below the existing `createParticipants` helper)

```ts
import type { Match } from './types.js';

// Winners-bracket match IDs that can reach (matchId, slot) by any feed path.
// Independent re-implementation used only to verify the library's output.
function winnersAncestry(matches: Match[], matchId: string, slot: 1 | 2): Set<string> {
	const acc = new Set<string>();
	const feeders = matches.filter(
		(m) =>
			(m.nextMatchId === matchId && m.nextMatchSlot === slot) ||
			(m.loserNextMatchId === matchId && m.loserNextMatchSlot === slot)
	);
	for (const f of feeders) {
		if (f.bracketType === 'winners') {
			acc.add(f.id);
		} else {
			for (const s of [1, 2] as const) {
				for (const id of winnersAncestry(matches, f.id, s)) acc.add(id);
			}
		}
	}
	return acc;
}

// Asserts no "double jeopardy": for every WB round-r loser drop (r = 2 .. winnersRounds-1),
// the losers match it drops into must have a slot-1 (sitting) player whose winners-bracket
// history does NOT include any winners match the dropping player was in. The final WB->LB
// drop (WB finals loser -> LB final) is excluded because a rematch there is forced.
function assertNoEarlyRematch(matches: Match[]): void {
	const winnersRounds = Math.max(
		...matches.filter((m) => m.bracketType === 'winners').map((m) => m.round)
	);
	const drops = matches.filter(
		(m) => m.bracketType === 'winners' && m.round >= 2 && m.round <= winnersRounds - 1
	);
	for (const m of drops) {
		expect(m.loserNextMatchId, `WB ${m.round}/${m.position} has no loser target`).toBeTruthy();
		const own = new Set<string>([m.id]);
		for (const s of [1, 2] as const)
			for (const id of winnersAncestry(matches, m.id, s)) own.add(id);
		const sitting = winnersAncestry(matches, m.loserNextMatchId!, 1);
		const overlap = [...own].filter((id) => sitting.has(id));
		expect(
			overlap,
			`double jeopardy: WB ${m.round}/${m.position} loser dropped against its own WB path (${overlap.join(',')})`
		).toEqual([]);
	}
}
```

- [ ] **Step 2: Add a failing test that reproduces the bug at 8 players**

```ts
describe('losers bracket rematch avoidance', () => {
	it('never drops a WB loser into a losers match fed by its own WB path (8 players)', () => {
		const bracket = generateDoubleElimination({
			tournamentId: 'test',
			participants: createParticipants(8),
		});
		assertNoEarlyRematch(bracket.matches);
	});
});
```

- [ ] **Step 3: Run it and confirm it FAILS**

Run: `npm test -- -t "rematch avoidance"`
Expected: FAIL — the assertion reports "double jeopardy: WB 2/... loser dropped against its own WB path (...)". (Confirms the straight mapping is buggy and the oracle detects it.)

- [ ] **Step 4: Commit the RED test**

```bash
git add src/double-elimination.test.ts
git commit -m "test(double-elim): failing invariant — WB losers must not drop into their own path"
```

---

## Task 2: Implement the crossover assignment (GREEN)

**Files:**
- Modify: `src/double-elimination.ts`

- [ ] **Step 1: Add a private `winnersAncestry` helper to `double-elimination.ts`** (module scope, above `linkWinnersToLosers`)

```ts
// Winners-bracket match IDs that can reach (matchId, slot) via any feed path.
// Used to place WB losers opposite players they haven't met.
function winnersAncestry(matches: Match[], matchId: string, slot: 1 | 2): Set<string> {
	const acc = new Set<string>();
	const feeders = matches.filter(
		(m) =>
			(m.nextMatchId === matchId && m.nextMatchSlot === slot) ||
			(m.loserNextMatchId === matchId && m.loserNextMatchSlot === slot)
	);
	for (const f of feeders) {
		if (f.bracketType === 'winners') {
			acc.add(f.id);
		} else {
			for (const s of [1, 2] as const) {
				for (const id of winnersAncestry(matches, f.id, s)) acc.add(id);
			}
		}
	}
	return acc;
}
```

- [ ] **Step 2: Replace the drop-in mapping in `linkWinnersToLosers`**

In `linkWinnersToLosers`, the `for (let wRound = 1; wRound < winnersRounds; wRound++)` loop currently links each winners match to a losers match. Keep the `wRound === 1` branch exactly as-is (two WB matches → one LB match via `Math.floor(i / 2)` / slots 1,2). Replace the handling for `wRound >= 2` with an ancestry-disjoint assignment.

Change the loop body so that:
- For `wRound === 1`: keep the existing per-match logic (`losersMatchIndex = Math.floor(i / 2)`, `slot = (i % 2 === 0) ? 1 : 2`) and set `winnersMatch.loserNextMatchId` / `loserNextMatchSlot` as today.
- For `wRound >= 2`: skip the per-match index math and instead assign the whole round at once, immediately after computing `losersMatches` for that round:

```ts
		if (wRound >= 2) {
			// Ancestry-disjoint drop: each WB round-r loser (slot 2) is placed into a
			// losers match whose sitting player (slot 1) came from a different WB path,
			// so the two never met. Winners rounds are linked in increasing order, so by
			// the time round r is placed, all earlier drops (and thus slot-1 ancestries)
			// are already set.
			const sortedLosers = [...losersMatches].sort((a, b) => a.position - b.position);
			const sittingAncestry = sortedLosers.map((lm) => winnersAncestry(matches, lm.id, 1));
			const used = new Set<number>();
			const sortedWinners = [...winnersMatches].sort((a, b) => a.position - b.position);
			for (const wm of sortedWinners) {
				const own = new Set<string>([wm.id]);
				for (const s of [1, 2] as const)
					for (const id of winnersAncestry(matches, wm.id, s)) own.add(id);
				let chosen = sortedLosers.findIndex(
					(_, p) => !used.has(p) && ![...sittingAncestry[p]].some((id) => own.has(id))
				);
				if (chosen === -1) chosen = sortedLosers.findIndex((_, p) => !used.has(p));
				used.add(chosen);
				wm.loserNextMatchId = sortedLosers[chosen].id;
				wm.loserNextMatchSlot = 2;
			}
			continue; // whole round handled; skip the per-match `for (i...)` below
		}
```

Place this block right after `const losersMatches = matches.filter(...)` and before the existing `for (let i = 0; i < winnersMatches.length; i++)` loop, so the per-match loop only runs for `wRound === 1`. (The `losersRound = wRound * 2 - 2` calculation above it is unchanged and still used to select `losersMatches`.)

- [ ] **Step 3: Run the invariant test — expect GREEN at 8 players**

Run: `npm test -- -t "rematch avoidance"`
Expected: PASS.

- [ ] **Step 4: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all existing tests still pass (structure, counts, `reportDoubleElimMatchResult` progression). If a pre-existing test asserted a specific buggy `loserNextMatchId` value, update that expectation to the new correct target and note it in the commit.

- [ ] **Step 5: Commit**

```bash
git add src/double-elimination.ts
git commit -m "fix(double-elim): crossover WB->LB drop to avoid double-jeopardy rematch"
```

---

## Task 3: Size matrix + g-league regression

**Files:**
- Modify: `src/double-elimination.test.ts`

- [ ] **Step 1: Add the size matrix and bye-heavy case to the existing `describe('losers bracket rematch avoidance', ...)` block**

```ts
	it.each([4, 8, 16, 32])('holds the invariant for %i players (power of two)', (n) => {
		const bracket = generateDoubleElimination({
			tournamentId: 'test',
			participants: createParticipants(n),
		});
		assertNoEarlyRematch(bracket.matches);
	});

	it('holds the invariant with byes (17 players -> size 32, g-league shape)', () => {
		const bracket = generateDoubleElimination({
			tournamentId: 'test',
			participants: createParticipants(17),
		});
		assertNoEarlyRematch(bracket.matches);
	});
```

- [ ] **Step 2: Add an explicit g-league regression assertion**

```ts
	it('WR2M1 loser is not routed into the LB match fed by WR1M1/WR1M2 (g-league)', () => {
		const bracket = generateDoubleElimination({
			tournamentId: 'test',
			participants: createParticipants(16),
		});
		const wr2m1 = bracket.matches.find(
			(m) => m.bracketType === 'winners' && m.round === 2 && m.position === 1
		)!;
		const target = wr2m1.loserNextMatchId!;
		// The forbidden target is the LB match whose slot-1 ancestry includes WR1M1/WR1M2.
		const forbidden = new Set(['test_WR1M1', 'test_WR1M2']);
		const sitting = winnersAncestry(bracket.matches, target, 1);
		const clash = [...sitting].filter((id) => forbidden.has(id));
		expect(clash, `WR2M1 loser drops against ${clash.join(',')}`).toEqual([]);
	});
```

Note: winners-match IDs are produced by `generateMatchId(tournamentId, 'winners', round, position)`. Confirm the exact format by logging one ID (e.g. `console.log(bracket.matches.find(m=>m.bracketType==='winners')!.id)`) and adjust the `'test_WR1M1'` literals to match (the prod data uses the pattern `{tournamentId}_WR{round}M{position}`).

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS — all sizes, byes, and the g-league regression green.

- [ ] **Step 4: Commit**

```bash
git add src/double-elimination.test.ts
git commit -m "test(double-elim): invariant across sizes 4/8/16/32, byes, g-league regression"
```

---

## Task 4: Rebuild dist, typecheck, push

**Files:**
- Rebuild: `dist/` (committed compiled output)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Rebuild the committed compiled output**

Run: `npm run build`
Expected: `dist/` regenerated (this is what `erena-web` actually imports — it is served from git).

- [ ] **Step 3: Commit the rebuilt dist and push**

```bash
git add dist
git commit -m "build(double-elim): rebuild dist with crossover routing"
git push -u origin fix/losers-bracket-double-jeopardy
```

- [ ] **Step 4: Confirm the compiled fix is present in dist**

Run: `grep -c "winnersAncestry" dist/double-elimination.js`
Expected: ≥ 1 (the new helper is in the compiled output).

---

## Task 5: Rollout to erena-web + beta smoke test

**Files:**
- Modify: `erena-web/package.json`, `erena-web/package-lock.json`

- [ ] **Step 1: Merge the fix to `erena-bracket`'s default branch**

The `erena-web` dependency is pinned loosely as `github:appboy-io/erena-bracket` (resolves to the default branch). Open a PR from `fix/losers-bracket-double-jeopardy` and merge it, OR (for a beta trial first) point the dependency at the branch in the next step.

- [ ] **Step 2: Bump the locked commit in erena-web**

From `erena-web/` (on a feature branch, not `development`/`main` directly):
```bash
npm install erena-bracket@github:appboy-io/erena-bracket
```
This updates `package-lock.json` to the new resolved commit. (Without this, beta's `npm ci` reinstalls the old commit and the rebuild is a no-op.)

- [ ] **Step 3: Typecheck erena-web**

Run (from `erena-web/`): `npm run check`
Expected: 0 errors (the generator's public API is unchanged; only internal routing changed).

- [ ] **Step 4: Commit + push erena-web branch**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): bump erena-bracket to crossover losers routing"
git push
```

- [ ] **Step 5: Beta smoke test (manual)**

After beta rebuilds:
1. Create a fresh test double-elim tournament on beta and generate its bracket.
2. Read its match records from beta PB and run `assertNoEarlyRematch` (or the equivalent inline check) against the real generated data.
3. Confirm no "double jeopardy" pairing exists.

This re-confirms the deploy took; correctness itself is already proven by Task 3.

---

## Self-Review Notes

- **Spec coverage:** root-cause fix in `linkWinnersToLosers` (Task 2) ✓; correctness via structural invariant (Tasks 1,3) ✓; sizes 4/8/16/32 + byes (Task 3) ✓; g-league regression (Task 3) ✓; no migration of existing brackets (out of scope — never touched) ✓; `dist/` rebuild so the fix reaches consumers (Task 4) ✓; erena-web dep bump + beta smoke (Task 5) ✓; no backend changes (none in plan) ✓.
- **Invariant scope:** deliberately limited to WB rounds `2 .. winnersRounds-1`; the forced WB-finals→LB-finals drop is excluded (documented in `assertNoEarlyRematch`).
- **Independent oracle:** the test's `winnersAncestry` is a separate implementation from the library's; the test verifies the *resulting* `loserNextMatchId` pointers, not the assignment code.
- **Determinism:** the greedy assignment picks the lowest-position disjoint unused target — deterministic across runs.
- **Type consistency:** `winnersAncestry(matches, matchId, slot)` has the same signature in test and library; `assertNoEarlyRematch(matches)` used consistently.
- **Risk flagged:** if greedy ever leaves no disjoint target for a size (not expected for standard power-of-two shapes), the invariant test for that size fails loudly rather than shipping a bad bracket — at which point a full bipartite matching would replace the greedy step.
