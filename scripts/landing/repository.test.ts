import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  MutableRef,
  Option,
  Ref,
  Schema,
} from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/process";
import { TestClock } from "effect/testing";
import { githubRepository } from "#scripts/landing/repository";
import { type Candidate, Repository } from "#scripts/landing/train";
import { collectText, runText } from "#scripts/process";
import { type Answer, scriptedShell } from "#scripts/test.shell";

const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const git = (cwd: string, ...args: readonly string[]) =>
  runText("git", args, cwd).pipe(
    Effect.tap((output) =>
      output.code === 0
        ? Effect.void
        : Effect.die(`git ${Arr.join(args, " ")}: ${output.stderr}`)
    ),
    Effect.map((output) => output.stdout.trim())
  );

/**
 * An origin with main and two pull request heads, #1 and #2, which change the
 * same line, and a clone of it where the train runs.
 */
const origins = Effect.fn("RepositoryTest.origins")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const base = yield* fs.makeTempDirectoryScoped({ prefix: "train-" });
  const origin = `${base}/origin.git`;
  const work = `${base}/work`;
  yield* git(
    base,
    "init",
    "--quiet",
    "--bare",
    "--initial-branch=main",
    origin
  );
  yield* git(base, "clone", "--quiet", origin, work);
  const identity = ["-c", "user.name=Train", "-c", "user.email=train@test"];
  const commit = Effect.fn(function* (file: string, text: string) {
    yield* fs.writeFileString(`${work}/${file}`, text);
    yield* git(work, "add", file);
    yield* git(work, ...identity, "commit", "--quiet", "-m", file);
    return yield* git(work, "rev-parse", "HEAD");
  });
  const main = yield* commit("readme.md", "base\n");
  yield* git(work, "push", "--quiet", "origin", "HEAD:refs/heads/main");
  const heads = yield* Effect.forEach(
    [
      [1, "one\n"],
      [2, "two\n"],
      [3, "three\n"],
    ] as const,
    Effect.fn(function* ([number, text]) {
      yield* git(work, "checkout", "--quiet", "--detach", main);
      const sha = yield* commit(number === 3 ? "other.md" : "readme.md", text);
      yield* git(
        work,
        "push",
        "--quiet",
        "origin",
        `${sha}:refs/pull/${number}/head`
      );
      return { number, sha, title: `Change ${number}` };
    })
  );
  return { origin, work, main, heads };
});

/** Runs a program against the repository of `root`, with gh answered by `script`. */
const withRepository = <A, E>(
  root: string,
  script: (args: readonly string[]) => Answer | undefined,
  program: Effect.Effect<
    A,
    E,
    Repository | ChildProcessSpawner.ChildProcessSpawner
  >
) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<readonly string[]>([]);
    const shell = scriptedShell(
      (command, args) => (command === "gh" ? script(args) : undefined),
      calls
    );
    const value = yield* program.pipe(
      Effect.provide(Layer.provideMerge(githubRepository(root), shell))
    );
    return { value, calls: yield* Ref.get(calls) };
  });

const STATUS = (state: string) =>
  toJson({ statuses: [{ context: "proof", state }] });

describe("train repository", () => {
  it.effect("takes the open, ready pull requests whose proof passed", () =>
    Effect.gen(function* () {
      const { value } = yield* withRepository(
        "/root",
        (args) => {
          if (args[0] === "pr") {
            return {
              stdout: toJson([
                {
                  number: 9,
                  headRefOid: "c".repeat(40),
                  title: "C",
                  isDraft: false,
                },
                {
                  number: 4,
                  headRefOid: "a".repeat(40),
                  title: "A",
                  isDraft: false,
                },
                {
                  number: 5,
                  headRefOid: "b".repeat(40),
                  title: "B",
                  isDraft: true,
                },
                {
                  number: 6,
                  headRefOid: "d".repeat(40),
                  title: "D",
                  isDraft: false,
                },
              ]),
            };
          }
          return {
            stdout: String(args[1]).includes("d".repeat(40))
              ? STATUS("failure")
              : STATUS("success"),
          };
        },
        Effect.gen(function* () {
          const repository = yield* Repository;
          return {
            all: yield* repository.proven([]),
            named: yield* repository.proven([9]),
          };
        })
      );
      expect(Arr.map(value.all, (one) => one.number)).toEqual([4, 9]);
      expect(Arr.map(value.named, (one) => one.number)).toEqual([9]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "merges heads onto main by SHA, sets aside a conflict, publishes the result and deletes it at the end",
    () =>
      Effect.gen(function* () {
        const { origin, work, main, heads } = yield* origins();
        const [one, two, three] = Arr.map([0, 1, 2], (index) =>
          Option.getOrThrow(Arr.get(heads, index))
        );
        const { value } = yield* withRepository(
          work,
          () => undefined,
          Effect.gen(function* () {
            const repository = yield* Repository;
            const combination = yield* repository.combine(main, [
              one,
              two,
              three,
            ]);
            return {
              main: yield* repository.main,
              combination,
              published: yield* git(
                origin,
                "rev-parse",
                `refs/heads/nabil/train-${combination.sha.slice(0, 12)}`
              ),
              conflicting: yield* repository
                .combine(main, [two])
                .pipe(Effect.andThen(repository.combine(main, []))),
            };
          })
        );
        expect(value.main).toBe(main);
        expect(value.combination.merged).toEqual([one, three]);
        expect(value.combination.conflicted).toEqual([two]);
        expect(value.conflicting.sha).toBe(main);
        expect(value.published).toBe(value.combination.sha);
        expect(
          yield* git(work, "rev-parse", `${value.combination.sha}^2`)
        ).toBe(three.sha);
        // The repository's scope ended with the program, and its branch with it.
        expect(
          (yield* runText(
            "git",
            [
              "rev-parse",
              "--verify",
              `refs/heads/nabil/train-${value.combination.sha.slice(0, 12)}`,
            ],
            origin
          )).code
        ).not.toBe(0);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect(
    "keeps a published branch it cannot delete, and fails without an origin main",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { origin, work, main, heads } = yield* origins();
        yield* withRepository(
          work,
          () => undefined,
          Effect.flatMap(Repository, (repository) =>
            repository
              .combine(main, [Arr.headNonEmpty(heads)])
              .pipe(Effect.andThen(fs.remove(origin, { recursive: true })))
          )
        );
        const failure = yield* withRepository(
          work,
          () => undefined,
          Effect.flatMap(Repository, (repository) => repository.main)
        ).pipe(Effect.flip);
        expect(failure.message).toContain("git ls-remote");
        const empty = yield* fs.makeTempDirectoryScoped();
        yield* git(empty, "init", "--quiet", "--bare");
        yield* git(work, "remote", "set-url", "origin", empty);
        const missing = yield* withRepository(
          work,
          () => undefined,
          Effect.flatMap(Repository, (repository) => repository.main)
        ).pipe(Effect.flip);
        expect(missing.message).toBe("origin has no main branch.");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("cancels the push deploys still running and starts one", () =>
    Effect.gen(function* () {
      const { calls } = yield* withRepository(
        "/root",
        (args) =>
          args[1] === "list"
            ? {
                stdout: toJson([
                  { databaseId: 11, status: "in_progress" },
                  { databaseId: 12, status: "completed" },
                ]),
              }
            : {},
        Effect.flatMap(Repository, (repository) => repository.deploy)
      );
      expect(Arr.drop(calls, 1)).toEqual([
        "gh run cancel 11 --repo nakafaai/nakafa.com",
        "gh workflow run deploy.yml --repo nakafaai/nakafa.com --ref main -f stage=prod",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});

const CANDIDATE: Candidate = {
  number: 42,
  sha: "e".repeat(40),
  title: "Land me",
};

/** A pull request view as `gh pr view` prints it. */
const view = (overrides: Record<string, string> = {}) => ({
  stdout: toJson({
    state: "OPEN",
    headRefOid: CANDIDATE.sha,
    mergeable: "MERGEABLE",
    baseRefName: "main",
    ...overrides,
  }),
});

const land = (script: (args: readonly string[]) => Answer | undefined) =>
  withRepository(
    "/root",
    script,
    Effect.flatMap(Repository, (repository) => repository.land(CANDIDATE))
  );

describe("train landing", () => {
  it.effect(
    "squash-merges at the proven head, and skips what moved or cannot merge",
    () =>
      Effect.gen(function* () {
        const landed = yield* land((args) =>
          args[1] === "view" ? view() : {}
        );
        expect(landed.value).toEqual({ _tag: "landed", candidate: CANDIDATE });
        expect(landed.calls[1]).toBe(
          `gh pr merge 42 --repo nakafaai/nakafa.com --squash --match-head-commit ${CANDIDATE.sha} --subject Land me (#42)`
        );
        const reasons = yield* Effect.forEach(
          [
            view({ state: "MERGED" }),
            view({ headRefOid: "f".repeat(40) }),
            view({ baseRefName: "nabil/base" }),
            view({ mergeable: "CONFLICTING" }),
          ],
          (answer) =>
            land((args) => (args[1] === "view" ? answer : {})).pipe(
              Effect.map(({ value }) =>
                value._tag === "skipped" ? value.reason : ""
              )
            )
        );
        const refused = yield* land((args) =>
          args[1] === "view"
            ? view()
            : { code: 1, stderr: "Pull request is in clean status\n" }
        );
        expect([
          ...reasons,
          refused.value._tag === "skipped" ? refused.value.reason : "",
        ]).toEqual([
          "already merged",
          "its head moved after its proof: prove the new head",
          "it targets nabil/base: land its base first, then prove it again",
          "GitHub reports it conflicting",
          "Pull request is in clean status",
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("lands a stacked pull request through the asynchronous merge", () =>
    Effect.gen(function* () {
      const views = [
        view({ mergeable: "UNKNOWN" }),
        view(),
        view({ state: "MERGED" }),
      ];
      const viewed = MutableRef.make(0);
      const fiber = yield* land((args) => {
        if (args[1] === "view") {
          return views[MutableRef.getAndIncrement(viewed)] ?? view();
        }
        return args[1] === "merge"
          ? {
              code: 1,
              stderr: "must be merged using the asynchronous merge REST API",
            }
          : {};
      }).pipe(Effect.forkChild);
      while (fiber.pollUnsafe() === undefined) {
        yield* TestClock.withLive(Effect.sleep("20 millis"));
        yield* TestClock.adjust("5 seconds");
      }
      const { value, calls } = yield* Fiber.join(fiber);
      expect(value).toEqual({ _tag: "landed", candidate: CANDIDATE });
      expect(calls).toContain(
        `gh api -X PUT repos/nakafaai/nakafa.com/pulls/42/merge-async -f merge_action=direct_merge -f merge_method=squash -f sha=${CANDIDATE.sha} -f commit_title=Land me (#42)`
      );

      const stuck = yield* land((args) =>
        args[1] === "merge" ? { code: 1, stderr: "asynchronous merge" } : view()
      ).pipe(Effect.forkChild);
      while (stuck.pollUnsafe() === undefined) {
        yield* TestClock.withLive(Effect.sleep("5 millis"));
        yield* TestClock.adjust("5 seconds");
      }
      const result = yield* Fiber.join(stuck);
      expect(result.value).toEqual({
        _tag: "skipped",
        candidate: CANDIDATE,
        reason: "the asynchronous merge did not finish in two minutes",
      });
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "fails when GitHub answers what it cannot read, or gh cannot start",
    () =>
      Effect.gen(function* () {
        const unreadable = yield* land(() => ({ stdout: "not json" })).pipe(
          Effect.flip
        );
        expect(unreadable.message).toContain("GitHub answered unexpectedly");
        const failing = yield* land(() => ({
          code: 1,
          stderr: "offline",
        })).pipe(Effect.flip);
        expect(failing.message).toBe("gh pr view failed: offline");
        const missing = yield* withRepository(
          "/nonexistent/train/root",
          () => undefined,
          Effect.flatMap(Repository, (repository) => repository.main)
        ).pipe(Effect.flip);
        expect(missing.message).toBe("git could not start.");
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("runs a pipeline that no script answers as it is", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<readonly string[]>([]);
      const piped = yield* Effect.gen(function* () {
        const child = yield* ChildProcess.make("printf", ["piped"]).pipe(
          ChildProcess.pipeTo(ChildProcess.make("cat"))
        );
        return yield* collectText(child.stdout);
      }).pipe(
        Effect.scoped,
        Effect.provide(scriptedShell(() => undefined, calls))
      );
      expect(piped).toBe("piped");
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );
});
