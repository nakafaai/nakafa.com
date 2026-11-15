import {
  Array as Arr,
  Effect,
  HashSet,
  Layer,
  Option,
  Ref,
  Result,
  Schema,
  Scope,
  String as Str,
} from "effect";
import { ChildProcessSpawner } from "effect/process";
import { GATE_CONTEXT } from "#scripts/gate/github";
import { attempt, decoded, gh, run } from "#scripts/landing/command";
import { landPull } from "#scripts/landing/merge";
import {
  highestProven,
  landingOrder,
  Pull,
  type Rider,
  ridersOf,
  stacksOf,
} from "#scripts/landing/stack";
import {
  type Candidate,
  type Combination,
  Repository,
  TrainError,
} from "#scripts/landing/train";
import { REPOSITORY } from "#scripts/proof/client";
import { VERDICT_CONTEXT } from "#scripts/proof/github";

/** A spec file of the browser suites, as a path in the repository; its group is the path under `apps/www`. */
const SPEC_FILE = /^apps\/www\/(?<spec>e2e\/.+\.browser\.ts)$/u;

/** A file the product runs: under `apps` or `packages`, outside the browser specs, and no Markdown. */
const RUNTIME_FILE = /^(?:apps|packages)\/(?!www\/e2e\/)(?!.*\.md$)/u;

/** A pull request as a candidate of the train, with its stack, the head below it, the spec files it adds or changes, and whether it changes what the product runs. */
const candidateOf = ({ pull, stack, below }: Rider): Candidate => ({
  number: pull.number,
  stack,
  below,
  sha: pull.headRefOid,
  title: pull.title,
  specs: Arr.filterMap(pull.files, ({ path }) =>
    Option.match(Option.fromNullishOr(SPEC_FILE.exec(path)?.groups?.spec), {
      onNone: () => Result.failVoid,
      onSome: Result.succeed,
    })
  ),
  runtime: Arr.some(pull.files, ({ path }) => RUNTIME_FILE.test(path)),
});

/** A full commit SHA, as `git ls-remote` prints one. */
const COMMIT_SHA = /^[0-9a-f]{40}$/u;

/**
 * The statuses that prove a head in the browsers: the run's own summary when
 * all three engines pass, or the verdict `bun run proof` posts when the head
 * fails nothing main does not.
 */
const PROOF_CONTEXTS = ["proof", VERDICT_CONTEXT];

const PullListJson = Schema.fromJsonString(Schema.Array(Pull));

const StatusJson = Schema.fromJsonString(
  Schema.Struct({
    statuses: Schema.Array(
      Schema.Struct({ context: Schema.String, state: Schema.String })
    ),
  })
);

const DeployRunsJson = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ databaseId: Schema.Int, status: Schema.String }))
);

/** Which of these commit status contexts passed on one exact head. */
const passedOn = Effect.fn("landing.passedOn")(function* (sha: string) {
  const { statuses } = yield* gh([
    "api",
    `repos/${REPOSITORY}/commits/${sha}/status`,
  ]).pipe(Effect.flatMap(decoded(StatusJson)));
  return (contexts: readonly string[]) =>
    Arr.some(
      statuses,
      (status) =>
        Arr.contains(contexts, status.context) && status.state === "success"
    );
});

/**
 * Whether a head may ride: its static gate passed and its browser proof passed,
 * both on that exact head.
 */
const provenHead = Effect.fn("landing.provenHead")(function* (sha: string) {
  const passed = yield* passedOn(sha);
  return passed([GATE_CONTEXT]) && passed(PROOF_CONTEXTS);
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

      /**
       * The members below a stack's proven top that it carries: those whose head
       * the top's head contains, so its gate and proof ran on their changes.
       */
      const carried = (top: Pull, below: readonly Pull[]) =>
        Effect.gen(function* () {
          if (below.length === 0) {
            return Arr.empty<Pull>();
          }
          yield* git([
            "fetch",
            "--quiet",
            "origin",
            ...Arr.map(
              [...below, top],
              (pull) => `refs/pull/${pull.number}/head`
            ),
          ]);
          return yield* Effect.filter(below, (member) =>
            attempt(
              "git",
              [
                "merge-base",
                "--is-ancestor",
                member.headRefOid,
                top.headRefOid,
              ],
              root
            ).pipe(Effect.map((output) => output.code === 0))
          );
        });

      /** The exact head of main on origin. */
      const mainHead = git(["ls-remote", "origin", "refs/heads/main"]).pipe(
        Effect.map((line) => Arr.headNonEmpty(Str.split(line, "\t"))),
        Effect.filterOrFail(
          (sha) => COMMIT_SHA.test(sha),
          () => new TrainError({ message: "origin has no main branch." })
        )
      );

      /**
       * Whether a stack may join a batch: its top's own gate passed on a head
       * that contains main's tip, so that gate ran on today's main, and the top
       * carries every member below it. A head gated on an older main costs one
       * gate of its own, side by side with every other, while a batch it breaks
       * costs a bisect, one verification after another.
       */
      const entering = (stack: Arr.NonEmptyReadonlyArray<Pull>, tip: string) =>
        Effect.gen(function* () {
          const top = Arr.lastNonEmpty(stack);
          const passed = yield* passedOn(top.headRefOid);
          if (!passed([GATE_CONTEXT])) {
            return false;
          }
          const fresh = yield* attempt(
            "git",
            ["merge-base", "--is-ancestor", tip, top.headRefOid],
            root
          );
          if (fresh.code !== 0) {
            return false;
          }
          const below = Arr.dropRight(stack, 1);
          return (yield* carried(top, below)).length === below.length;
        });

      /** The open pull requests that are no draft. */
      const openPulls = gh([
        "pr",
        "list",
        "--repo",
        REPOSITORY,
        "--state",
        "open",
        "--limit",
        "200",
        "--json",
        "number,headRefOid,headRefName,baseRefName,title,isDraft,files",
      ]).pipe(
        Effect.flatMap(decoded(PullListJson)),
        Effect.map(Arr.filter((pull: Pull) => !pull.isDraft))
      );

      return {
        proven: (numbers) =>
          provide(
            Effect.gen(function* () {
              const pulls = yield* openPulls;
              const stacks = stacksOf(pulls);
              const proven = HashSet.fromIterable(
                Arr.map(
                  yield* Effect.filter(Arr.flatten(stacks), (pull) =>
                    provenHead(pull.headRefOid)
                  ),
                  (pull) => pull.number
                )
              );
              const riding = yield* Effect.forEach(stacks, (stack) =>
                Option.match(
                  highestProven(stack, (pull) =>
                    HashSet.has(proven, pull.number)
                  ),
                  {
                    onNone: () => Effect.succeed(Arr.empty<Rider>()),
                    onSome: ({ top, below }) =>
                      carried(top, below).pipe(
                        Effect.map((members) => {
                          const chosen = HashSet.fromIterable(
                            Arr.map(
                              Arr.append(members, top),
                              (pull) => pull.number
                            )
                          );
                          return Arr.filter(ridersOf(stack), (rider) =>
                            HashSet.has(chosen, rider.pull.number)
                          );
                        })
                      ),
                  }
                )
              );
              return Arr.map(
                Arr.filter(
                  landingOrder(Arr.flatten(riding)),
                  ({ pull }) =>
                    numbers.length === 0 || Arr.contains(numbers, pull.number)
                ),
                candidateOf
              );
            })
          ),
        ready: (numbers) =>
          provide(
            Effect.gen(function* () {
              const pulls = yield* openPulls;
              const tip = yield* mainHead;
              yield* git([
                "fetch",
                "--quiet",
                "origin",
                "refs/heads/main",
                ...Arr.map(pulls, (pull) => `refs/pull/${pull.number}/head`),
              ]);
              const stacks = yield* Effect.filter(stacksOf(pulls), (stack) =>
                entering(stack, tip)
              );
              return Arr.map(
                Arr.filter(
                  landingOrder(Arr.flatMap(stacks, ridersOf)),
                  ({ pull }) =>
                    numbers.length === 0 || Arr.contains(numbers, pull.number)
                ),
                candidateOf
              );
            })
          ),
        main: provide(mainHead),
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
        land: (candidate) => provide(landPull(root, candidate)),
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
