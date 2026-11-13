import { Effect, FileSystem, Layer, Ref, Schema, String as Str } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { run } from "#scripts/landing/command";
import { githubRepository } from "#scripts/landing/repository";
import { type Candidate, Repository } from "#scripts/landing/train";
import { type Answer, scriptedShell } from "#scripts/test.shell";

/** A test that runs real Git or many scripted processes waits for them on a loaded machine. */
export const PROCESS_TIMEOUT = 60_000;

export const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** Runs Git in a fixture repository, where a failure is a broken test. */
export const git = (cwd: string, ...args: readonly string[]) =>
  run("git", args, cwd).pipe(Effect.orDie, Effect.map(Str.trim));

/**
 * An origin with main and two pull request heads, #1 and #2, which change the
 * same line, and a clone of it where the train runs.
 */
export const origins = Effect.fn("RepositoryTest.origins")(function* () {
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
      return {
        number,
        stack: number,
        sha,
        title: `Change ${number}`,
        specs: [],
      };
    })
  );
  return { origin, work, main, heads };
});

/** Runs a program against the repository of `root`, with gh answered by `script`. */
export const withRepository = <A, E>(
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

export const STATUS = (state: string, gate = "success") =>
  toJson({
    statuses: [
      { context: "gate", state: gate },
      { context: "proof", state },
    ],
  });

/** The statuses of each fixture head: d failed its proof, e has no passed gate yet. */
export const statusOf = (path: string) => {
  if (path.includes("d".repeat(40))) {
    return STATUS("failure");
  }
  return path.includes("e".repeat(40))
    ? STATUS("success", "pending")
    : STATUS("success");
};

export const CANDIDATE: Candidate = {
  number: 42,
  stack: 42,
  sha: "e".repeat(40),
  title: "Land me",
  specs: [],
};

/** A pull request view as `gh pr view` prints it. */
export const view = (overrides: Record<string, string> = {}) => ({
  stdout: toJson({
    state: "OPEN",
    headRefOid: CANDIDATE.sha,
    mergeable: "MERGEABLE",
    baseRefName: "main",
    ...overrides,
  }),
});

export const land = (script: (args: readonly string[]) => Answer | undefined) =>
  withRepository(
    "/root",
    script,
    Effect.flatMap(Repository, (repository) => repository.land(CANDIDATE))
  );
