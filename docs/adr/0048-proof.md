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
7. **Sharing the runners.** The train verifies at most 8 stacks at once, so Aksara's gates and the deploy keep runners. A train or baseline run cancelled from outside, such as one a session moved back in the queue, is dispatched again, at most three times, instead of being read as a failure.
8. **Landing as it goes.** A green group lands at once, by each exact head, and deploys, instead of waiting for the train to finish every split; only what landed joins the base of the next verification, so a head that moved or that GitHub refused never hides in a later combination.

## Amendment: The Engines Side By Side, 15 November 2026

Train 5 of 15 November verified 34 pull requests in one run. Its gate took 30 minutes and its build 8, and then Chromium, Firefox and WebKit ran the specs one after another on the same machine until the job reached its 350-minute limit at 07:19 CET, with no verdict and nothing landed. The work of the three engines is independent, and only the order made it long. On the same night 16 proof runs dispatched within one minute all started at once, so jobs that need no other job leave the queue together. What the measurement of 13 November punished was the `needs` stage, which queues again from the back.

1. **Four jobs, no `needs`.** `.github/workflows/proof.yml` runs the gate in one job and each engine in a job of its own, all four dispatched together. Each engine job installs, prepares, builds and proves on its own machine. The three builds cost machine minutes that the free runners do not bill, and the specs take the time of the slowest engine instead of the sum of all three.
2. **Statuses.** The gate job posts `gate/<part>` and `gate` as before. Each engine job posts `proof/<engine>` and then reads this run's three engine statuses on the head, and the engine that finds all three final posts `proof`. Each engine posts its own status before it reads the others, so the last to finish always sees them all and `proof` stays the last status a run posts.
3. **Results.** Each engine uploads `results-<engine>` and `traces-<engine>`. `bun run proof` and the train download every `results-*` artifact of the run, and an engine whose build failed uploads none and counts as failed.
4. **Phases.** A run's phases are read across its jobs: each phase runs from the first of its steps to start to the last to end, and the queue runs from the dispatch to the first job that started. A job that a dispatch turned off, such as the gate of a baseline, counts for nothing.
5. **Sharing the runners.** One verification now takes four of the account's 20 jobs, so the train verifies at most four stacks of a red batch at once, 16 jobs, and leaves the rest to Aksara's gates, the sessions' gates and the deploy.

## Amendment: Batch Entry On Today's Main, 15 November 2026

No pull request landed on nakafa.com for more than 10 hours after #2504 (23:45 CET, 14 November). Batch mode admitted every open pull request that was no draft, whatever its own gate said (`scripts/landing/train.ts`, `Repository.ready`), so a batch carried heads that failed on their own or that were gated on an older main, and each such head failed the combination and cost a bisect. Measured over the proof runs of 13 to 15 November (238 completed runs on pull request heads, read from `gh run list` and each run's steps): the gate failed on 34% of the 198 distinct heads it checked, and 73% of the 89 heads that ran specs failed one, most of them specs that fail on main too.

1. **Entry.** A stack joins a batch only when its top's own `gate` passed on a head that contains main's tip, so that gate ran on today's main, and the top carries every member below it. Its own proof is not asked for, since the batch proves the combination.
2. **Why the gate moves to each head.** A head gated on an older main costs one gate of its own, and those gates run side by side, up to the account's 20 concurrent jobs. A head that breaks a batch costs a bisect, one verification after another, each round a full gate and proof of a smaller combination.
3. **Keeping heads fresh.** After every landing, the heads in the queue no longer contain main. Each waiting head merges main and gates again before it rides; until the queue does this by itself, the owning session does it.

## Amendment: A Flake Is Run Again Before A Batch Splits, 15 November 2026

The proof runs with no retries and a 120-second test timeout (`apps/www/playwright.config.ts`), so one timing miss in a batch of five fails the whole combination, and the bisect that follows costs a verification per round. Playwright calls a test that fails and then passes on a retry "flaky" (playwright.dev/docs/test-retries, read 15 November 2026); Bors splits a failed batch to find its culprit (github.com/bors-ng/bors-ng).

1. **Run again first.** Before a combination splits, every failing spec that main does not fail runs once more, alone, on the same combination. A spec that passes is recorded as a flake with the combination it flaked on, and rejects nothing; a spec that fails again stays a failure and the batch splits as before. A failed gate or a proof that named no spec never runs again.
2. **Never hidden.** The train's report names each flake, so it gets an owner and a due time on the tracker. No spec is skipped, deleted, or retried inside Playwright for it.

## Amendment: The Landing Queue, 15 November 2026

The queue grows with the speed of the work: 108 open pull requests that are no draft on 15 November, against 15 landed on 14 November and one in the 12 hours that followed. Measured over 13 to 15 November (references in the takeover tracker's `ops/research/references.md`): 400 proof runs, of which 146 were cancelled; a completed run took 27 minutes at the median and 50 at the 90th percentile; the gate failed on 34% of the distinct heads it checked. With independent failures at a rate p per pull request, a batch of n passes with probability (1 - p)^n (a derivation, not a sourced claim): at p = 0.1, five pass 59% of the time, 13 pass 25%, 34 pass 3%.

### Decision

1. **Build on the train, not a vendor queue.** The comparison below scores GitHub's merge queue, Mergify, Graphite and Trunk against the train. The train already lands stacks whole by exact head, compares failures with main, splits a red batch by stack and lands green groups as it goes; what it lacked is speed, entry discipline and a rule for flakes.
2. **Small batches.** A batch holds at most five pull requests, a stack whole when it fits and in chunks of at most five from the bottom when it does not. Five is the size that passes more often than not at p = 0.1; it is revised from each week's measured p.
3. **Fresh entry.** A stack enters only when its top's own gate passed on a head that contains main (amendment "Batch Entry On Today's Main").
4. **Engines side by side.** The gate and each engine are jobs of their own (amendment "The Engines Side By Side"); an engine whose specs run longer than about 20 minutes is sharded across more jobs of its own.
5. **Flakes run again before a split** (amendment "A Flake Is Run Again Before A Batch Splits").
6. **Speculative pipelining, bounded.** While batch N verifies, batch N+1 verifies on top of main plus N, as Zuul's dependent pipeline does (zuul-ci.org/docs/zuul/latest/gating.html); when N fails, every batch built on it is discarded and verified again on what did land. The depth is bounded by the account's 20 concurrent jobs: four jobs per verification, four kept for Aksara's gates, the sessions' gates and the deploy, so at most four verifications at once.
7. **A queue that runs itself.** The queue becomes a GitHub Actions workflow that advances one step per run and exits: it reads the queue, merges main into the heads that need it, dispatches their gates, forms the next batch, dispatches its verification, lands a green batch and starts the deploy. It runs on a schedule and on `workflow_dispatch`, with the deploy app's installation token, because events made with `GITHUB_TOKEN` start no other workflow (docs.github.com/en/actions/concepts/security/github_token). No step waits inside a session or on the Mac.
8. **Specs from the change, a full proof after.** A batch proves the specs its pull requests change plus the suites of the routes they touch; a scheduled full proof of main runs after landings, as predictive test selection pairs a selected run before merge with complete runs after (arxiv.org/abs/1810.05286).
9. **Main stays green.** When the full proof of main or a deploy turns red, the queue opens the culprit's revert at once and lands it first.
10. **Rollback.** A broken Worker returns to its previous version with `wrangler rollback` (the last 100 versions; bindings and storage are not changed: developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/) while the revert lands; Alchemy itself rolls back only by deploying the previous code again (alchemy.run/cloudflare/compute/gradual-deployments). Convex cannot roll back functions and its backups restore data only, wiping what is there (docs.convex.dev/cli, docs.convex.dev/database/backup-restore), so a broken backend rolls forward through the revert. The procedure is tested on staging before it is needed.
11. **Faster gates.** Typecheck and unit-test tasks may restore a cache keyed by Turborepo's exact input hash; a prefix-restored cache stays rejected, and the signed www build is never cached (`AGENTS.md`).

### Build or buy

| | GitHub merge queue | Mergify | Graphite | Trunk | The train |
| --- | --- | --- | --- | --- | --- |
| Stacks as a unit | not stated in its docs | yes, at most 20 deep (our island stack is 41) | yes | public preview | yes, whole or in chunks |
| Batching and failure | groups 1 to 100; a failing PR is removed and the rest rebuilt | batch size with splits | private beta | not stated | batches with split by stack and halves |
| Checks | required checks on `merge_group` (rejected above for the wait they bring) | each queued PR gets its own CI run | not stated | not stated | gate on each head, one proof per batch |
| Cost for this public repository | free | free for open source | paid team plan | routed to sales | free |
| Code we maintain | workflow triggers | a config file and a ruleset bypass | none | none | `scripts/landing` |

GitHub's merge queue would bring back required checks, which this ADR rejected because they made merges wait on the runner queue, and its documentation does not cover stacked pull requests. Mergify would fit at no cost but caps a stack at 20 and runs CI for each queued pull request on our runners. Graphite is paid, Trunk's terms for a public repository are not published, and Bors-NG is archived. The train keeps stacks whole, costs nothing, and its gaps are closed by the points above.

### The ceiling of free runners

Twenty concurrent jobs, four per verification and four kept in reserve, give four verifications at once. With batches of at most five and a verification of about 30 minutes (the gate's 25 beside a build of 10 and sharded specs of 20), the queue lands at most 40 pull requests an hour when every batch passes, and fewer as p rises. When the median time from ready to merged stays above two hours for a week, or jobs wait in GitHub's queue more than 15 minutes, the next step is decided then: fewer specs per batch through selection, or a measured case for paid runners, which this repository does not use today.

## Amendment: A Batch That Changes Nothing The Product Runs Proves One Spec, 15 November 2026

A combination whose pull requests name no spec proved every suite, even when they changed only the landing scripts, a workflow or the docs, which the gate already checks. The first step of selecting specs from the change (amendment "The Landing Queue", point 8): a pull request changes what the product runs when it changes a file under `apps` or `packages` outside the browser specs and Markdown. A combination that names no spec proves every suite when one of its pull requests changes what the product runs, and only `e2e/quran/landing.browser.ts` when none does: a fast page that passed in all three engines on main (run 43699251319).

## Amendment: Stacks Stay Linear, And GitHub's Merge Queue Lands Them, 15 November 2026

Almost every pull request in this repository sits in a GitHub stack, and the day's landing failures all came from one cause: branches took main by a merge commit. #2552's head moved after its proof, the chain of #2554 to #2556 broke when main was merged into each member alone, #2556 could not be replayed and kept a duplicated block, and #2557 and #2560 grew to work around histories GitHub cannot rebase. GitHub's stacked pull request documentation, read in full on 15 November (every claim, its page and a quote are in the takeover tracker's `ops/research/stacks.md` and `references.md`), says why:

- A stack merges only with "a linear history between its branches"; history is lost "when the trunk moves ahead", and the merge box then offers "Rebase stack".
- Main enters a stack by cascading rebase only: `gh stack rebase`, `gh stack sync`, or the server-side "Rebase stack". No page supports merging main into a stack branch.
- When the bottom merges, "the remaining branches are automatically rebased" onto the base, so their heads change.
- `merge-async` is "the required API for merging stacked pull requests"; on a member it takes "all open downstack PRs", atomically. "Stacks support all three merge methods."
- "Stacks fully support merge queues": members are queued in order, an ejected member takes those above it out, and a merge group may grow by "up to 50 percent" to keep a stack whole.
- GitHub's merge queue tests each group "with the latest version of the base_branch" plus the pull requests ahead, and "does not require a pull request author to update their pull request branch". It is available in any public repository owned by an organization, at no cost.

The amendment "The Landing Queue" rejected GitHub's merge queue partly because "its documentation does not cover stacked pull requests". That was wrong, and with it the case for building our own queue falls.

### Decision

1. **A stack takes main by rebase, never by a merge commit.** `gh stack rebase` (or `gh stack sync`) and a push; a stack that already holds merges is rebuilt once as one linear commit per member, each tree proven equal to the tree it is meant to carry (`git merge-tree --write-tree`, `git rev-parse <commit>^{tree}`). A single pull request on main follows the same rule. A branch is updated only when `git merge-tree` against main reports a conflict, never because main moved.
2. **"Proven" means the same tree.** A member GitHub rebased carries a new SHA but, when nothing else landed, the tree that was verified; whatever checks a head compares trees, in one way, not one patch per case.
3. **A verified stack lands from its top in one step.** One `merge-async` on the topmost member to land (squash), or the merge queue taking the stack in order. Never member by member.
4. **Stack only what depends on an open pull request, at most five deep, and never as a tree.** A stack is one chain; work that branches waits until the shared base lands, then stacks on main. Longer work lands its bottom five first. The island stack (38 deep) and the tree under #2338 are cut into chains of five.
5. **GitHub's merge queue replaces the train.** The queue already does what the train was growing into: it admits a pull request on its own required check, tests each group on main plus the groups ahead (speculative pipelining by build concurrency), removes a failing pull request and rebuilds the rest, keeps stacks whole, and runs without a session. Settings: squash; group size at most 5; build concurrency 3 (four jobs per group, within the account's 20 with room for pull request gates and Aksara); "Only merge non-failing pull requests" on.
6. **One required check, two depths.** `proof.yml` runs on `pull_request` and `merge_group` and reports one check: on a pull request the gate; on a merge group the gate and the three engines over the specs the group changes (a group that changes nothing the product runs proves the smoke spec). The ruleset on main requires the merge queue and that check.
7. **Deleted with the switch.** The train's batching, splitting, flake rerun, landing and deploy dispatch (`scripts/landing`), its schedule (#2558) and the rebuilt-merge workaround (#2560) go in the change that turns the queue on; nothing keeps a second path. `freshen` (#2559) is not landed: it merged main into stack branches.
8. **Until the switch** the train still lands single pull requests and linear stacks, a stack from its top, and admits a head on its own gate and a clean `git merge-tree` against main, without a fresh gate after every landing.

### Build or buy, for stacks

| | GitHub merge queue | Mergify | Trunk | The train |
| --- | --- | --- | --- | --- |
| Native GitHub stacks | "Stacks fully support merge queues" | yes, "Maximum stack depth: 20" | public preview (vendors.md) | yes, with workarounds for merges in branches |
| Speculative groups | build concurrency 1 to 100 | "Up to 128" parallel checks | parallel mode | to build |
| Up-to-date branches required | no | not stated | not stated | yes, since #2551 |
| Cost for this public repository | free | free for open source | not published | free |
| Code and services we maintain | one workflow trigger, one ruleset | a vendor app, a config, a ruleset bypass | a vendor app | `scripts/landing` |

GitHub's queue is the platform's own, documented for stacks, free here, and leaves the least code to maintain. Mergify would cap stacks at 20 and add a vendor; Trunk's terms for a public repository are not published.


## Amendment: The Merge Queue Is Switched On, 15 November 2026

The amendment "Stacks Stay Linear, And GitHub's Merge Queue Lands Them" decided that GitHub's merge queue replaces the train behind one required check with two depths. This amendment records the workflow that reports it and the exact ruleset main switches on. GitHub's pages, read on 15 November 2026:

- The queue runs a workflow only through its own event: "You must use the `merge_group` event to trigger your GitHub Actions workflow when a pull request is added to a merge queue" (docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).
- A group is built "with the latest version of the `base_branch`" and the entries ahead of it (same page), and its `base_sha` is "The SHA of the merge group's parent commit" (the `merge_group` payload schema, github.com/octokit/webhooks, `payload-schemas/api.github.com/merge_group/checks_requested.schema.json`). With a build concurrency above one, a group's parent is the head of the group ahead, so its diff holds its own pull requests only, and each group ahead proves its own.
- "Required status checks can be checks or statuses", and a ruleset may "select an app as the expected source of status updates" (docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

### Decision

1. **One commit status, `verify`, posted at two depths by `.github/workflows/proof.yml`.**

   | Event | Jobs | Who posts `verify` | Description |
   | --- | --- | --- | --- |
   | `pull_request` (opened, synchronize, reopened, ready for review; a draft runs nothing) | the gate | the gate | "Gate passed; the merge queue proves the browsers", or "Gate failed" |
   | `merge_group` | the gate and the three engines, side by side | the last of the four to finish, from the gate and the three engine statuses of its run | "Gate, Chromium, Firefox and WebKit: success" or "failure" |
   | `workflow_dispatch` without the browsers (`bun run gate`) | the gate | the gate | as for a pull request |
   | `workflow_dispatch` with `base` (a merge group rehearsal) | the gate and the three engines | as for a merge group | as for a merge group |
   | `workflow_dispatch` with the browsers and no `base` (`bun run proof`, a baseline) | as asked | nobody | none |

   A commit status, not a job's check run, because one name must come from whichever of four jobs ends last: a fifth job that `needs` them would wait in the account's runner queue again from the back (amendment "One Job Per Head"). Each job posts its own status before it reads the others, so the last to finish sees all four, as `proof` is posted already. The gate, engine and summary statuses `gate/<part>`, `gate`, `proof/<engine>` and `proof` stay: `verify` is read from them, and `bun run gate` and `bun run proof` wait on them.
2. **Specs from the group's diff.** `scripts/proof/select.ts` owns which specs a merge group proves, from `git diff --name-only base_sha head_sha`: every spec file it changes that its head still holds, every spec in an `apps/www/e2e` folder whose name is a path segment of a changed file under `apps/www/src` (the file named without its extension), and the smoke spec `e2e/quran/landing.browser.ts` always. A group that changes nothing the product runs reaches no folder, so it proves its own spec files and the smoke spec. Selection proves fewer specs than every suite; a full proof of main after landings (amendment "The Landing Queue", point 8) is what catches the rest, and nothing schedules it yet.
3. **Concurrency.** A push to a pull request cancels the run of the head it replaced, whose statuses name only that older head. A merge group's run and every dispatch have a group of their own, so a later push never cancels them, and `scripts/proof/sweep.ts` cancels only dispatched runs.
4. **Pull requests already open.** A pull request gets `verify` on its next push, when it is marked ready, when it is reopened, or from `bun run gate <sha>` on its head. The queue admits a pull request only when `verify` passed on its head.
5. **Forks.** A pull request from a fork runs with a read-only token, so its run posts no status and it cannot enter the queue; its code reads no secret either way.
6. **Deploys.** The queue merges by pushing to main, and `deploy.yml` runs on that push. Its concurrency group keeps one deploy running and one waiting, so a burst of merged groups deploys the newest main once more, and nothing dispatches a deploy.
7. **Runners.** A merge group takes four of the account's 20 concurrent jobs; a build concurrency of 3 takes 12, which leaves room for pull request gates, Aksara and the deploy.

### The ruleset on `main`

Main sets it once the workflow above is on `main`; no session changes repository settings.

| Setting | Value | Ruleset API (`rules[]`) |
| --- | --- | --- |
| Target | the default branch, `main` (the queue "cannot be enabled with branch protection rules that use wildcard characters") | `conditions.ref_name.include: ["~DEFAULT_BRANCH"]` |
| Require a pull request before merging | on, as today | `pull_request` |
| Require status checks to pass | `verify` | `required_status_checks`: `required_status_checks: [{ context: "verify" }]` |
| Require branches to be up to date before merging | off: the queue tests each group on the latest main and "does not require a pull request author to update their pull request branch" | `strict_required_status_checks_policy: false` |
| Require merge queue | on | `merge_queue` |
| Merge method | squash | `merge_method: "SQUASH"` |
| Only merge non-failing pull requests | on | `grouping_strategy: "ALLGREEN"` |
| Build concurrency | 3 | `max_entries_to_build: 3` |
| Minimum group size | 1 | `min_entries_to_merge: 1` |
| Maximum group size | 5 | `max_entries_to_merge: 5` |
| Wait time to meet minimum group size | 5 minutes | `min_entries_to_merge_wait_minutes: 5` |
| Status check timeout | 90 minutes: a completed proof run took 27 minutes at the median and 50 at the 90th percentile (amendment "The Landing Queue") | `check_response_timeout_minutes: 90` |

`verify` names no expected source, so any token with write access to the repository may post it; a session never posts it by hand.

A `merge_group` run's `GITHUB_SHA` is the "SHA of the merge group" (docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), so it runs the workflow file that group's head holds. This change and the stack below it land on `main` before the ruleset is switched: a group built on an older main would run a `proof.yml` that posts no `verify`, and wait out the status check timeout.

### Consequences

- A pull request is merged by adding it to the queue once `verify` passed on its exact head: `gh pr merge <number> --match-head-commit <sha>`, or `merge-async` on a stack's top, which queues every member below. A head whose `verify` has not passed is not added, because `gh pr merge` then turns on auto-merge, which stays off.
- The rehearsal (`workflow_dispatch` with `base`) is how a change to this workflow proves the merge group path before main switches the ruleset, since only the queue sends `merge_group`.
- The second change deletes what the queue replaces (amendment "The Train Is Deleted").

## Amendment: The Train Is Deleted, 15 November 2026

The merge queue landed its first group on the ruleset of the amendment "The Merge Queue Is Switched On", so the train's code goes in one change, as the amendment "Stacks Stay Linear" decided (point 7), with no second path kept.

1. **Deleted.** `scripts/landing` (batching, splitting by stack and halves, the flake rerun, landing by exact head, the deploy dispatch and their tests) and `bun run train`. The amendments above that describe the train stay as the record of why the queue replaced it.
2. **Deleted with it, because only the train read them.** The `proof/new` status that `bun run proof` posted, the prover's `verify` (a gate and proof in one run of a combination), the baseline's list of what main fails, the sweep's keep of train branch tips, and the Git author the gate job set for the train's tests.
3. **Kept.** `bun run gate <sha>`, which admits a head by posting `verify`, and `bun run proof <sha> [spec...]`, which proves any head in the browsers and compares its failures with main for a session. `scripts/proof/select.ts` keeps `SMOKE_SPEC` and the spec rule beside the merge group selection it serves.

## Amendment: A Merge Group Sets Aside What Its Base Fails, 15 November 2026

The first groups whose diffs reach many folders failed on specs that main fails itself: #2520 (theme tokens) failed the same marketing and memory editor specs, which it does not reach, in its groups of 15:50 and 17:02, on bases two hours apart, and main's own proof of those specs failed them too (run 43741889339, on 2bfa74f46e: `memory.browser.ts:382` and the pricing, header and steady specs in all three engines). One cause is plain in the history: `e2e/settings/memory.browser.ts:382` fails in all three engines since #2289 (8 November) left the caret after an applied link, because #2274 merged four minutes later from an older base with the spec still expecting the selection. Others never ran before the engines stood side by side: marketing and memory specs in Firefox and WebKit. The train set such failures aside by proving them on main (amendment "The Landing Queue"); the queue judged every failure of a group as its own, so every group whose diff reaches those folders failed, whatever it changed.

### Decision

1. **The verdict.** The job that finishes last posts `verify` through `.github/actions/verdict`: four successes pass at once, and a failed gate fails. A passed gate beside a failed engine downloads the engines' results and runs `scripts/proof/group.ts`, which proves the failing spec files on the group's `base_sha` (main, or the head of the group ahead) in all three engines through `makeBaseline`, the rule `bun run proof` applies to a head, and fails the group only on a spec its base passes, a suite that failed outside every test, or an engine that never reported. The status says which: "No new failure against main <base>; N fail there too", or "N new failures against main <base>". The run's summary lists every spec, new or set aside.
2. **The base proof.** It is a dispatched run of this workflow, so the gate and engine jobs hold `actions: write`. `scripts/proof/sweep.ts` keeps the heads of the queue's `gh-readonly-queue/` branches beside open pull requests and main, so a group's base proof is never cancelled as superseded.
3. **Status check timeout: 150 minutes.** A group that proves every suite took up to 80 minutes, and a base proof adds a build and the failing specs, about 25 minutes while runners are free.
4. **What main fails stays work.** A spec set aside is main's defect, never a reason to skip, retry or weaken it: the lane that owns its folder makes main pass it, and each fix narrows what a verdict sets aside.

## Amendment: The Backend Suite In Shards, 16 November 2026

The gate ran its three parts one after another in one job, and the backend suite, 1,074 test files and 7,781 tests, set its pace: 10 to 14 minutes after static (3 to 4) and www (3 to 4). No file dominates it (the slowest takes 10 seconds, and the tests' own time is a third of the run); importing each file's modules and its setup take the rest, file by file. Measured on one runner, one after another (run 43767878264): two workers, the configuration's half of four cores, 844 seconds; four workers 677; four workers on threads 606; half the files on four workers 354. A runner's four cores are saturated at two workers, and a shard scales with its share of the files.

### Decision

1. **Three shards beside the gate.** The `backend` job runs the suite in three shards on three runners at once (`--shard=<n>/3`, every core of each), while the gate job runs static and www. A shard writes its results and its coverage as a Vitest blob and checks no threshold, since a file's tests may stand in another shard.
2. **The last shard merges.** No job waits on the shards, since a job that `needs` others waits for a runner again from the back of the account's queue. Each shard posts `gate/backend-<n>` after its blob is kept, then reads the others'; the shard that finds all three final merges the blobs (`vitest run --merge-reports`), checks every changed file at 100% per file on the merged coverage, as one run did, and posts `gate/backend`. Fewer blobs than shards fails it.
3. **Nothing to run, nothing run.** Each shard first asks turbo whether the head reaches the backend suite (`--affected --dry=json`, after the install). When it does not, the first shard posts `gate/backend` and the others end, so such a head spends only the install and that question.
4. **The last part posts the gate.** The gate job posts `gate/static` and `gate/www`; whichever of it and the backend shards posts the last part finds the three final and posts `gate`, and `verify` for a pull request (`.github/actions/gate`), then runs the group's verdict as before. Each job posts its part before it reads, so the later reader always finds all three.

### Consequences

The backend part takes about one shard and a merge, some 5 minutes, inside the 6 to 8 of static and www, so a gate takes about as long as those two. A verification holds up to three more jobs for those minutes, of the account's twenty (see "The ceiling of free runners"); the runner minutes stay about the same, plus each shard's install of some 30 seconds.

## Amendment: One Build For Selected Specs, 16 November 2026

A merge group proves the specs its diff selects, often only the smoke spec, yet each of the three engine jobs installed, prepared, built and started the same head on its own machine. Merge group runs 43759530064, 43758332497 and 43756713192 took 18 to 26 minutes and 45 to 68 runner-minutes each. Every engine job spent 0.8 to 1.1 minutes installing Node for Convex, 3.4 to 5.8 preparing, 5.1 to 8.4 building and 0.9 to 1.3 starting, and only 0.2 to 0.6 on its specs, so about 40 of a group's runner-minutes were the same work done three times, and the three machines starved the account's 20 jobs.

### Decision

1. **One machine for selected specs.** When a run proves selected specs (a merge group, its rehearsal, a named dispatch, and so the base proof of a group's verdict), the proof matrix has one entry, all three engines: it installs, prepares, builds and starts once, then runs Chromium, Firefox under a virtual display, and WebKit one after another against that runtime (the order `bun run proof --local` already used). A run that proves every suite keeps one machine per engine, side by side, because its specs take far longer than the build. Every test seeds its own learner, school and chats (`apps/www/playwright.config.ts`), so the engines need no runtime of their own.
2. **Statuses and results do not change.** The job posts `proof/<engine>` for each engine it ran, and the job that finds all three final posts `proof`. Each engine uploads `results-<engine>`, so `bun run proof`, `.github/actions/verdict` and `scripts/proof/group.ts` read a run the same way. Playwright empties its output folder on every run, so each engine's traces move aside before the next starts, into one `traces-<engines>` artifact with the start and browser install logs.
3. **Browsers.** `~/.cache/ms-playwright` is cached by the Playwright release and the engines a machine runs. The system packages install only when a browser file links a library the machine lacks or Firefox finds no `xvfb-run`; WebKit always lacks some on the hosted image, so its machine installs them, in the background while the runtime builds.
4. **One after another, not side by side on one machine.** The same ten `e2e/quran` specs took 6.0 minutes one after another (run 43768256227) and 4.6 side by side with one worker each (run 43768571242), with the same failures in both. Side by side would need a Playwright output folder per engine and lets the timing suites of one engine run beside another's load, for 1.4 minutes on ten specs and seconds on the smoke spec, so the engines run one after another.
5. **Measured.** The ten-spec run took 13.6 minutes wall and 13.6 runner-minutes on one machine (prepared runtime restored, build 5.0, start 0.8, specs 6.0). The three-job shape spends the install, Node, prepare, build and start on each of three machines for the same specs, about 28 runner-minutes with a restored runtime and about 40 without.
6. **What the measurement found.** Both runs fail `e2e/quran/flow.browser.ts` in Chromium (its first engine, alone on a fresh runtime) and `e2e/quran/outline.browser.ts` and `e2e/quran/search.browser.ts` in WebKit. The head carries main's app code unchanged, Chromium failed first and alone on a fresh runtime, and no merge group selected these specs before, so these are main's failures, not the shared runtime's; the lane that owns the Quran pages makes them pass, as "What main fails stays work" requires.

## Amendment: The Proof's Setup And Main's Caches, 16 November 2026

After "One Build For Selected Specs", a proof machine still spent about a minute installing Node for Convex through Homebrew and regenerated the bindings the gate already compares, and its caches never hit in a merge group: a group runs on a `gh-readonly-queue/` branch, which reads only main's cache scope, and this workflow never ran on main, so the prepared runtime prepared and saved in every group and the save served no later one.

### Decision

1. **Node for Convex from the tool cache.** The proof installs the Node major that `convex.json` names through `actions/setup-node` before the workspace's Node, which then comes first on the PATH, and names its `bin` directory in `CONVEX_NODE_BIN`. `resolveConvexNodeBin` takes that directory when it is set and Homebrew's otherwise, so the Mac keeps `brew install node@24`.
2. **No codegen in the proof.** The proof reads the committed bindings. The gate regenerates them on the same head and fails a head whose bindings differ, and only the gate posts `verify` on a pull request.
3. **Warming main.** A push to main runs one job, `Warm`, and no gate or proof. It looks the prepared runtime of main's head up without downloading it and prepares and saves it only when main's scope lacks it, and it downloads and saves the browsers of the machine that runs all three engines when that key is missing. A merge group whose head changes no input of the prepared runtime restores main's, and every group restores the browsers. A newer push cancels the warming of the main it replaced.
4. **No task cache for the gate.** A group's gate runs `--affected` against main, so every task it runs belongs to a workspace the group changes or one that depends on it, and that task's Turborepo hash includes the group's change, which no run on main ever computed. A cache warmed on main would therefore never hit a group's gate, and the tasks it could hit are the ones `--affected` already skips; within a pull request's own scope a restored task would only serve its later pushes, at the risk of a stale pass for a task with an undeclared input. The signed `www` build stays outside every cache, as AGENTS.md requires.
5. **The prepared runtime's key stays whole.** The snapshot holds rows that the backend's own content-release ingress wrote when prepare published the acceptance release (`confect/contentRelease`), and a start pushes the current functions but never ingests again. A key that left out the backend's functions would restore a snapshot that older ingestion code wrote, so a change to ingestion could pass its proof on data its own code never produced. The key keeps every backend input, and warming main makes it hit for every head that changes none.

## Amendment: A Merge Group's Gate Tests Its Own Change, 15 November 2026

A group's specs come from its diff to its base (point 2 of "The Merge Queue Is Switched On"), but its gate measured the affected workspaces against main, so each group tested again every workspace the entries ahead of it changed. The backend suite, about 1,056 test files and some 20 minutes on a runner, ran in almost every group, because some entry ahead touched the backend or a package it depends on, and the queue's throughput fell to the length of that suite.

### Decision

A merge group's gate measures `--affected` against its `base_sha` (and a rehearsal against its `base`): the workspaces its own pull requests change and their dependents, on the group's whole tree. Each group ahead proves its own changes on the same tree minus the later entries, so a workspace this group does not change holds the code those groups proved. A pull request and a dispatched gate still measure against main. Backend coverage keeps counting the files changed since main whenever its suite runs.

## Amendment: Every Group Judges Against Main's Head, 15 November 2026

A group whose engines failed proved its failing specs on its own `base_sha` (point 1 of "A Merge Group Sets Aside What Its Base Fails"). Every group but the first has the head of the group ahead as its base, so four groups that failed on the same red specs of main dispatched four base proofs, each a build, a prepare and the specs in three engines, about 17 minutes while runners are free, and each held three more of the 20 jobs the account shares. On 15 November from 22:17 the groups of #2475 and #2520 each waited on such a proof while the queue behind them stood still.

### Decision

1. **Main's head.** `scripts/proof/group.ts` proves a group's failing specs on main's head when it judges, not on the group's base, and the status names that commit. Every group in the queue then judges against the same commit until the next entry lands.
2. **One run per head and specs.** A proof of specs alone, without the gate, is named `Proof <sha> base-<key>-<suffix>`: the key is the first 16 hexadecimal digits of the SHA-256 of its spec files in path order, and the suffix is fresh. Before dispatching, `proveOnGithub` reads the latest 50 dispatched runs and awaits or reads one whose name starts with `Proof <sha> base-<key>`, finished or running, and passes over a cancelled one. The first group to fail on main's reds pays for the proof, and the others read it.
3. **What this gives up.** A group judged while an entry ahead of it fixes one of main's reds, and that itself breaks the spec again, has the spec set aside although its base passed it. Main then fails the spec as it did before the fix, the case point 4 of the earlier amendment leaves to the lane that owns the folder; the queue stops paying a base proof per group for it.

## Amendment: The Queue Waits Six Hours And Builds Four Groups, 16 November 2026

Chunk 1 (#2338, #2340, #2370, #2410 and #2472, a linked stack that touches shared folders) selected every suite, and its group ran the specs in three engines for 3 hours 45 minutes on 16 November: about 40 specs that main fails, each run again after its 120-second timeout, pushed the run past the 150-minute status check timeout of point 3 of "A Merge Group Sets Aside What Its Base Fails". The queue then removes the group for a missing `verify`, although nothing failed. Between 01:12 and 04:00 UTC no group landed.

### Decision

1. **Status check timeout: 360 minutes.** It covers a group that selects every suite, with its base proof, while the account's runners are busy. `check_response_timeout_minutes: 360` in ruleset 19504599, set 16 November at 03:00 UTC.
2. **Build concurrency: 4.** Four groups take 16 of the account's 20 concurrent jobs, and the pull request gates and Aksara take the rest. `max_entries_to_build: 4`.
3. **A large group goes last.** Groups merge in queue order, so a group that selects every suite holds every group behind it until its run ends. Main orders the queue by the size of each entry's selection (`scripts/proof/select.ts`), smallest first, and moves an entry whose selection reaches most suites behind the rest.
4. **The timeout comes back down** once an engine whose specs run longer than about 20 minutes is sharded across more jobs, as point 4 of "The Landing Queue" decided, and once main fails no spec, so a group's longest run is again its slowest shard.
