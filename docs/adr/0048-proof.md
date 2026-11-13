# ADR 0048: An On-Demand Proof Runner, A Prepared Runtime Cache And A Landing Train

## Status

Accepted on 9 November 2026, with the owner's approval of the same day. It amends ADR 0007's amendment of 17 October 2026 (Local Verification Replaces CI): GitHub Actions return, but only as a tool that sessions call on demand, never as a required check. The quality bar does not move.

## Context

Every pull request is proven on a production build of its exact head, in Chromium, WebKit and Firefox. Until now one Mac did all of it, through one queue (`heavy.sh`) with one runtime slot: one local Convex backend on port 3210 and one served app. Measured over rounds c9 to c9c on 9 November 2026:

| Step | Time | Why |
| --- | --- | --- |
| Queue wait | 0 to 3 h | one slot, so proofs run strictly one at a time |
| Prepare | 4 min | codegen, the first push and the signed publication of the acceptance release, every time |
| Build | 4 to 7 min | the static prerender of every public page |
| Specs | 10 to 25 min | broad suites on one machine |
| Flake | one more proof | 1,135 `EADDRNOTAVAIL` in one run: the preview proxy opens a loopback connection per request (alchemy-run/alchemy#3194) |

With 45 open pull requests that landed 2 or 3 an hour. A round that proved many at once stopped all of them on one red spec, and the orchestrator kept `heads.txt`, `merged.txt` and `land.txt` by hand, three copies of one fact.

CI was deleted on 17 October because required checks made merges wait on a runner queue. Today the wait is the single Mac slot, three times longer. `nakafaai/nakafa.com` is public, so GitHub's standard hosted runners cost nothing.

## Decision

1. **Proof runner.** `.github/workflows/proof.yml` proves one exact head, dispatched only by `workflow_dispatch` with the head's SHA, an optional selection of spec files and a machine count per engine. It never runs on `pull_request`, so no fork can start it, and no ruleset names it. One job checks out the head, prepares and builds once against the local `convex-local-backend` binary with the inert environment of `localApplicationEnvironment`. Its build goes to one spec machine per shard of each engine, each with its own backend and ports, so the loopback contention of one machine is gone. The report job posts the commit statuses `proof/chromium`, `proof/firefox`, `proof/webkit` and the summary `proof` on the head. A proof reads no secret, touches no Convex or Cloudflare deployment, deploys nothing and uses no paid runner.
2. **One seam, two adapters.** Sessions call `bun run proof <sha> [spec...]` (`scripts/proof`), which dispatches, waits and prints each engine's verdict, the failing specs and the phases of the run: queue, prepare (restored or prepared), build, specs. `bun run proof --local <sha> [spec...]` is the second adapter: the same suites in the same three engines on this Mac through `acceptance proof`, which a session runs through the Mac's queue to debug a proof.
3. **Prepared runtime cache.** The acceptance runtime keys its prepared state by a SHA-256 of what that state depends on: every file Git lists in `packages/backend` and the workspaces it depends on, the root manifest and `bun.lock`, the pinned Aksara revision (`source.json`), the renderer manifest the publication reads, and the app origin. Prepare restores the snapshot of an unchanged key and prepares and saves on a miss: in CI under `actions/cache` by that exact key, never a prefix, on the Mac in `~/.cache/nakafa/acceptance` (three newest kept). Every start still pushes the current functions, so a snapshot never serves stale code. `snapshot.test.ts` proves that each input changes the key and that a changed key restores nothing.
4. **Landing train.** `bun run train [pr...]` (`scripts/landing`) takes the open pull requests whose own `proof` status passed on their current head, merges those heads onto main by SHA with `git merge-tree` and proves the combination once. A failing spec that also fails on main belongs to main: the train reports it and ignores it. Any other failure splits the batch in halves, each proven on top of what the train already accepted, so the passing half lands and the failing pull request is named. It lands the accepted set with `gh pr merge --squash --match-head-commit`, or the asynchronous merge that a GitHub stack requires, and starts one production deploy. Its tests drive it with a fake prover and a fake repository.
5. **Three engines by construction.** `apps/www/playwright.config.ts` gives each UI suite a Chromium, a Firefox and a WebKit project, and `PLAYWRIGHT_ENGINE` selects one engine for a machine. Firefox and WebKit leave out only the specs that read Chromium's DevTools protocol.

## Consequences

- Proofs run in parallel on free runners instead of one at a time, at the same bar: a production build of the exact head in all three engines. GitHub's free plan runs 20 jobs at once across the account, so a full proof of three shards per engine (11 jobs) shares that with other proofs, and a proof narrowed to a pull request's own specs takes one shard per engine.
- A head that predates the runner (no `acceptance key`) fails its proof at once and asks for a merge of main. Every lane merges main anyway.
- The Mac queue stays for local debugging and for work that needs this machine.
- Nothing waits for a proof to merge: the statuses are evidence for the session and the train, and the owner's merge rule in `AGENTS.md` still names the exact head.
- Cost: zero. Public-repository runners, caches and artifacts are free; the cache holds one prepared runtime of about 150 MB per key.

## Rejected

- Required checks, which brought back the wait that the 17 October decision removed.
- Preview deploys or a cloud Convex deployment per proof, which cost money and touch production infrastructure.
- A cache keyed by a prefix or restored from the nearest key, which could reuse state that a changed input no longer produces.

## Amendment: The Static Gate On The Same Runners, 13 November 2026

The browser proofs moved, and the Mac's queue stayed the bottleneck for the rest of the verification: on 13 November its load ran 60 to 130 with its swap full and about 30 static gates waiting, so nothing landed for two hours.

1. **Gate.** `.github/workflows/gate.yml` runs that rest on the same free runners, dispatched only by `workflow_dispatch` with the head's SHA. Gates share the account's 20 concurrent jobs with the proofs, so a gate takes three machines: `static` (every workspace typecheck, judged by exit code and with the inert loopback Convex addresses `AGENTS.md` names, the committed bindings unchanged, `bun run lint` with the Effect source parity, `check:patches`, `check:tests`, Ultracite and the CAS lint, React Doctor on the head's changes against main, the dependency audit, the scripts suite and every workspace suite but two), and `www` and `backend`, the two large suites, beside it. Every suite keeps its per-file 100% coverage gate, and the static part runs every command, so one failure never hides another. Each part posts `gate/<part>` on the head, and the report posts `gate`. It reads no secret, and no ruleset names it.
2. **One command.** `bun run gate <sha>` (`scripts/gate`) dispatches it and reads the head's statuses until the run posts a `gate` verdict newer than the dispatch, by GitHub's clock. It reads them through GraphQL, one point per look every 90 seconds, so it spends nothing of the REST limit that every session of the account shares, and when fewer than 200 points remain it sleeps until the reset that GitHub's rate-limit headers name.
3. **Train.** `bun run train` takes only a head whose `gate` passed and whose `proof` or `proof/new` passed, both on that exact head.

## Amendment: The Batch Train, 13 November 2026

The free runners stayed the wall: about 90 runs waited for about 7 running jobs, and each open pull request spent a gate and a proof of its own before the train proved their combination again.

1. **Batch.** `bun run train --batch [pr...]` takes every open pull request that is no draft, whatever its own statuses say, each stack whole and bottom-up. The combined tree holds each exact head merged with main, which is what lands, so one gate and one proof of it, side by side, on the union of the specs the pull requests change, replace a gate and a proof per pull request. A failed gate of the combination is a failure no spec on main shares, so it bisects like a new failing spec, and every pull request still lands by its exact head with one production deploy.
2. **Stacks.** A stack's members below a proven top ride with it when the top's head contains theirs, so the top's gate and proof cover them; a lane gates and proves only its stack's top. The train lands a stack bottom-up and waits for GitHub to retarget each member at main before it lands it.
3. **Queue.** A proof sweep never cancels a head that is on main, so a baseline that the CLI or the train dispatches keeps its run, and `bun run proof` waits on the head's statuses through GraphQL for as long as the run stays queued, reading the run itself over REST only every fifth look.

## Amendment: One Job Per Head, 13 November 2026

Measured on 13 November, the queue's topology, not the work, set the time to land: gate run 43441357000 was created at 14:17 UTC, its parts started at 15:48 and worked 6 to 14 minutes, and its two-step Report job waited until 17:28, 3 hours 11 minutes for 14 minutes of work. Proof run 43439113440 waited 1 hour 3 minutes for its build, 1 hour 11 minutes more for its spec machines and another hour for its report: 3 hours 27 minutes for 13 minutes of work. Every `needs` stage of a workflow waits in the account's free runner queue again, from the back.

1. **One workflow, one job.** `.github/workflows/proof.yml` verifies one head, or one train combination, on one machine: it installs once, runs the gate, builds once and runs the specs in Chromium, Firefox and WebKit one after another. It posts every status from inside the job under the names the train and the sessions read: `gate/static`, `gate/www`, `gate/backend` and `gate` when the gate ends, then `proof/<engine>` and `proof` as its last step, after the results are uploaded. `gate.yml`, the build artifact and the spec matrix are gone.
2. **Scope.** A head or a train combination typechecks and tests only the workspaces it changes against main and their dependents (`turbo --affected`); `full` runs every workspace. The root checks (`check:tests`, Ultracite, the scripts suite, Doctor and the audit) always run.
3. **Callers.** `bun run proof <sha> [spec...]` dispatches the whole job and exits 0 only when the gate passed and the head fails nothing main does not. `bun run gate <sha>` dispatches it without the browsers. A baseline of main runs the browsers without the gate. The train verifies each combination through one run and reads its gate from the job's gate steps, so a failed gate bisects as before.
4. **Clean main merges.** Nothing re-verifies a head whose only change is a merge of main: the batch train merges main itself, so a session leaves a finished head as it is.
5. **Splitting a red batch.** A batch of several stacks that fails verifies every stack on its own, side by side, on top of what the train already accepted, so a split costs one wait in the runner queue instead of one wait for each half. The stacks that passed are verified together once more, unless every stack passed and they already failed together; a stack that fails splits in halves, and a pull request that fails alone is rejected with its failures.
6. **Scope of a train run.** A train combination is gated over the workspaces it changes against main, like a single head: its diff against main holds every head it merges, so the affected workspaces and their dependents are all it can break. `bun run train --batch --red` starts a batch that an earlier round already verified red at its split, so a restarted train does not spend a queue wait to learn it again.
