import {
  Array as Arr,
  Effect,
  Layer,
  Order,
  Ref,
  Schedule,
  Schema,
  Scope,
  String as Str,
} from "effect";
import { ChildProcessSpawner } from "effect/process";
import { GATE_CONTEXT } from "#scripts/gate/github";
import {
  type Candidate,
  type Combination,
  type Landing,
  Repository,
  TrainError,
} from "#scripts/landing/train";
import { runText } from "#scripts/process";
import { REPOSITORY, VERDICT_CONTEXT } from "#scripts/proof/github";

/** A full commit SHA, as `git ls-remote` prints one. */
const COMMIT_SHA = /^[0-9a-f]{40}$/u;

/**
 * The statuses that prove a head in the browsers: the run's own summary when
 * all three engines pass, or the verdict `bun run proof` posts when the head
 * fails nothing main does not.
 */
const PROOF_CONTEXTS = ["proof", VERDICT_CONTEXT];

/** Runs a command and returns how it exited and what it printed. */
const attempt = (command: string, args: readonly string[], cwd?: string) =>
  runText(command, args, cwd).pipe(
    Effect.mapError(
      () => new TrainError({ message: `${command} could not start.` })
    )
  );

/** Runs a command and returns what it printed, or fails with what it said. */
const run = Effect.fn("landing.run")(function* (
  command: string,
  args: readonly string[],
  cwd?: string
) {
  const output = yield* attempt(command, args, cwd);
  if (output.code !== 0) {
    return yield* new TrainError({
      message: `${command} ${Arr.join(Arr.take(args, 2), " ")} failed: ${output.stderr.trim()}`,
    });
  }
  return output.stdout;
});

/** Decodes what a command printed, failing as the train fails. */
const decoded =
  <A>(schema: Schema.Codec<A, string>) =>
  (text: string) =>
    Schema.decodeEffect(schema)(text).pipe(
      Effect.mapError(
        (error) =>
          new TrainError({
            message: `GitHub answered unexpectedly: ${error.message}`,
          })
      )
    );

const PullListJson = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      number: Schema.Int,
      headRefOid: Schema.String,
      title: Schema.String,
      isDraft: Schema.Boolean,
    })
  )
);

const StatusJson = Schema.fromJsonString(
  Schema.Struct({
    statuses: Schema.Array(
      Schema.Struct({ context: Schema.String, state: Schema.String })
    ),
  })
);

const PullViewJson = Schema.fromJsonString(
  Schema.Struct({
    state: Schema.String,
    headRefOid: Schema.String,
    mergeable: Schema.String,
    baseRefName: Schema.String,
  })
);

const DeployRunsJson = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ databaseId: Schema.Int, status: Schema.String }))
);

const gh = (args: readonly string[]) => run("gh", args);

/**
 * Whether a head may ride: its static gate passed and its browser proof passed,
 * both on that exact head.
 */
const provenHead = Effect.fn("landing.provenHead")(function* (sha: string) {
  const { statuses } = yield* gh([
    "api",
    `repos/${REPOSITORY}/commits/${sha}/status`,
  ]).pipe(Effect.flatMap(decoded(StatusJson)));
  const passed = (contexts: readonly string[]) =>
    Arr.some(
      statuses,
      (status) =>
        Arr.contains(contexts, status.context) && status.state === "success"
    );
  return passed([GATE_CONTEXT]) && passed(PROOF_CONTEXTS);
});

/** Reads one pull request, waiting while GitHub still computes whether it merges. */
const viewPull = Effect.fn("landing.viewPull")(function* (number: number) {
  return yield* gh([
    "pr",
    "view",
    String(number),
    "--repo",
    REPOSITORY,
    "--json",
    "state,headRefOid,mergeable,baseRefName",
  ]).pipe(
    Effect.flatMap(decoded(PullViewJson)),
    Effect.repeat({
      until: (view) => view.mergeable !== "UNKNOWN",
      schedule: Schedule.spaced("4 seconds"),
      times: 8,
    })
  );
});

/**
 * Squash-merges one pull request at the exact head the train proved. A pull
 * request of a GitHub stack refuses that merge and takes the asynchronous merge
 * instead, with the same head; the train then waits until GitHub reports it
 * merged.
 */
const landPull = Effect.fn("landing.landPull")(function* (
  candidate: Candidate
) {
  const skip = (reason: string): Landing => ({
    _tag: "skipped",
    candidate,
    reason,
  });
  const number = String(candidate.number);
  const view = yield* viewPull(candidate.number);
  if (view.state !== "OPEN") {
    return skip(`already ${view.state.toLowerCase()}`);
  }
  if (view.headRefOid !== candidate.sha) {
    return skip("its head moved after its proof: prove the new head");
  }
  if (view.baseRefName !== "main") {
    return skip(
      `it targets ${view.baseRefName}: land its base first, then prove it again`
    );
  }
  if (view.mergeable !== "MERGEABLE") {
    return skip(`GitHub reports it ${view.mergeable.toLowerCase()}`);
  }
  const subject = `${candidate.title} (#${candidate.number})`;
  const merge = yield* attempt("gh", [
    "pr",
    "merge",
    number,
    "--repo",
    REPOSITORY,
    "--squash",
    "--match-head-commit",
    candidate.sha,
    "--subject",
    subject,
  ]);
  if (merge.code === 0) {
    return { _tag: "landed", candidate } satisfies Landing;
  }
  if (!merge.stderr.includes("asynchronous merge")) {
    return skip(merge.stderr.trim());
  }
  yield* gh([
    "api",
    "-X",
    "PUT",
    `repos/${REPOSITORY}/pulls/${number}/merge-async`,
    "-f",
    "merge_action=direct_merge",
    "-f",
    "merge_method=squash",
    "-f",
    `sha=${candidate.sha}`,
    "-f",
    `commit_title=${subject}`,
  ]);
  const merged = yield* viewPull(candidate.number).pipe(
    Effect.repeat({
      until: (pull) => pull.state === "MERGED",
      schedule: Schedule.spaced("5 seconds"),
      times: 24,
    })
  );
  return merged.state === "MERGED"
    ? ({ _tag: "landed", candidate } satisfies Landing)
    : skip("the asynchronous merge did not finish in two minutes");
});

/**
 * The repository the train runs on: GitHub through its CLI, and Git in the
 * checkout at `root`. Each combination is a chain of merge commits made with
 * `git merge-tree`, so no worktree is checked out, and it is published on a
 * `nabil/train-` branch for the proof runner, which the train deletes when it
 * ends.
 */
export const githubRepository = (root: string) =>
  Layer.effect(
    Repository,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const scope = yield* Scope.Scope;
      const published = yield* Ref.make<readonly string[]>([]);
      const git = (args: readonly string[]) => run("git", args, root);
      yield* Scope.addFinalizer(
        scope,
        Ref.get(published).pipe(
          Effect.flatMap((branches) =>
            branches.length === 0
              ? Effect.void
              : git(["push", "--quiet", "origin", "--delete", ...branches])
          ),
          Effect.catchTag("TrainError", (error) =>
            Effect.logWarning(`The train branches stay: ${error.message}`)
          ),
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner
          )
        )
      );
      const provide = <A, E>(
        effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>
      ) =>
        effect.pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner
          )
        );

      return {
        proven: (numbers) =>
          provide(
            Effect.gen(function* () {
              const pulls = yield* gh([
                "pr",
                "list",
                "--repo",
                REPOSITORY,
                "--state",
                "open",
                "--base",
                "main",
                "--limit",
                "200",
                "--json",
                "number,headRefOid,title,isDraft",
              ]).pipe(Effect.flatMap(decoded(PullListJson)));
              const chosen = Arr.filter(
                pulls,
                (pull) =>
                  !pull.isDraft &&
                  (numbers.length === 0 || Arr.contains(numbers, pull.number))
              );
              const proven = yield* Effect.filter(chosen, (pull) =>
                provenHead(pull.headRefOid)
              );
              return Arr.sort(
                Arr.map(proven, (pull) => ({
                  number: pull.number,
                  sha: pull.headRefOid,
                  title: pull.title,
                })),
                Order.mapInput(Order.Number, (pull: Candidate) => pull.number)
              );
            })
          ),
        main: provide(
          git(["ls-remote", "origin", "refs/heads/main"]).pipe(
            Effect.map((line) => Arr.headNonEmpty(Str.split(line, "\t"))),
            Effect.filterOrFail(
              (sha) => COMMIT_SHA.test(sha),
              () => new TrainError({ message: "origin has no main branch." })
            )
          )
        ),
        combine: (base, heads) =>
          provide(
            Effect.gen(function* () {
              yield* git([
                "fetch",
                "--quiet",
                "origin",
                base,
                ...Arr.map(heads, (head) => `refs/pull/${head.number}/head`),
              ]);
              const combination = yield* Effect.reduce(
                heads,
                (): Combination => ({ sha: base, merged: [], conflicted: [] }),
                Effect.fn(function* (chain: Combination, head: Candidate) {
                  const tree = yield* attempt(
                    "git",
                    ["merge-tree", "--write-tree", chain.sha, head.sha],
                    root
                  );
                  if (tree.code !== 0) {
                    return {
                      ...chain,
                      conflicted: Arr.append(chain.conflicted, head),
                    };
                  }
                  const commit = yield* git([
                    "commit-tree",
                    Arr.headNonEmpty(Str.split(tree.stdout, "\n")),
                    "-p",
                    chain.sha,
                    "-p",
                    head.sha,
                    "-m",
                    `Train: merge #${head.number} at ${head.sha}`,
                  ]);
                  return {
                    ...chain,
                    sha: commit.trim(),
                    merged: Arr.append(chain.merged, head),
                  };
                })
              );
              const tip = combination.sha;
              if (tip !== base) {
                const branch = `nabil/train-${tip.slice(0, 12)}`;
                yield* git([
                  "push",
                  "--quiet",
                  "origin",
                  `${tip}:refs/heads/${branch}`,
                ]);
                yield* Ref.update(published, Arr.append(branch));
              }
              return combination;
            })
          ),
        land: (candidate) => provide(landPull(candidate)),
        deploy: provide(
          Effect.gen(function* () {
            const runs = yield* gh([
              "run",
              "list",
              "--repo",
              REPOSITORY,
              "--workflow",
              "deploy.yml",
              "--event",
              "push",
              "--limit",
              "20",
              "--json",
              "databaseId,status",
            ]).pipe(Effect.flatMap(decoded(DeployRunsJson)));
            yield* Effect.forEach(
              Arr.filter(runs, (one) => one.status !== "completed"),
              (one) =>
                gh([
                  "run",
                  "cancel",
                  String(one.databaseId),
                  "--repo",
                  REPOSITORY,
                ])
            );
            yield* gh([
              "workflow",
              "run",
              "deploy.yml",
              "--repo",
              REPOSITORY,
              "--ref",
              "main",
              "-f",
              "stage=prod",
            ]);
          })
        ),
      };
    })
  );
