import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Option, Ref } from "effect";
import {
  formatFreshen,
  freshen,
  parseFreshenArguments,
  runFreshenCli,
} from "#scripts/landing/freshen";
import { git, PROCESS_TIMEOUT, toJson } from "#scripts/landing/test.repository";
import { type Answer, scriptedShell } from "#scripts/test.shell";

/**
 * An origin whose main moved after five pull requests branched from it: #1,
 * then #2 and #5 on #1, #3 on #2, and #4 alone, which edits the line main's
 * new commit edits too. Each pull request's head is its branch and its
 * `refs/pull/<n>/head`, and the clone where freshen runs has an identity.
 */
const fixture = Effect.fn("FreshenTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const base = yield* fs.makeTempDirectoryScoped({ prefix: "freshen-" });
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
  yield* git(work, "config", "user.name", "Freshen");
  yield* git(work, "config", "user.email", "freshen@test");
  const commit = Effect.fn(function* (
    parent: string,
    file: string,
    text: string
  ) {
    if (parent !== "") {
      yield* git(work, "checkout", "--quiet", "--detach", parent);
    }
    yield* fs.writeFileString(`${work}/${file}`, text);
    yield* git(work, "add", file);
    yield* git(work, "commit", "--quiet", "-m", file);
    return yield* git(work, "rev-parse", "HEAD");
  });
  const first = yield* commit("", "readme.md", "base\n");
  yield* git(work, "push", "--quiet", "origin", `${first}:refs/heads/main`);
  const branch = Effect.fn(function* (
    number: number,
    parent: string,
    file: string,
    text: string
  ) {
    const sha = yield* commit(parent, file, text);
    yield* git(
      work,
      "push",
      "--quiet",
      "origin",
      `${sha}:refs/heads/b${number}`,
      `${sha}:refs/pull/${number}/head`
    );
    return sha;
  });
  const one = yield* branch(1, first, "one.md", "one\n");
  const two = yield* branch(2, one, "two.md", "two\n");
  yield* branch(3, two, "three.md", "three\n");
  yield* branch(4, first, "readme.md", "four\n");
  yield* branch(5, one, "five.md", "five\n");
  const moved = yield* commit(first, "readme.md", "base\nmoved\n");
  yield* git(work, "push", "--quiet", "origin", `${moved}:refs/heads/main`);
  return { origin, work, moved };
});

const BASES: Readonly<Record<number, string>> = {
  1: "main",
  2: "b1",
  3: "b2",
  4: "main",
  5: "b1",
};

/** The open pull requests as `gh pr list` prints them, each at its branch's head on the origin. */
const listed = Effect.fn("FreshenTest.listed")(function* (origin: string) {
  const pulls = yield* Effect.forEach([1, 2, 3, 4, 5], (number) =>
    git(origin, "rev-parse", `refs/heads/b${number}`).pipe(
      Effect.map((headRefOid) => ({
        number,
        headRefOid,
        headRefName: `b${number}`,
        baseRefName: BASES[number] ?? "main",
        title: `Change ${number}`,
        isDraft: number === 5,
        files: [],
      }))
    )
  );
  return toJson(pulls);
});

/**
 * Runs a program with gh answered by `script` (every gh call is answered, so
 * none reaches GitHub) and Git by `gitScript`, real Git where it answers nothing.
 */
const withShell = <A, E, R>(
  script: (args: readonly string[]) => Answer,
  program: Effect.Effect<A, E, R>,
  gitScript: (args: readonly string[]) => Answer | undefined = () => undefined
) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<readonly string[]>([]);
    const shell = scriptedShell(
      (command, args) => (command === "gh" ? script(args) : gitScript(args)),
      calls
    );
    const value = yield* program.pipe(Effect.provide(shell));
    return { value, calls: yield* Ref.get(calls) };
  });

const pullList = (list: string) => (args: readonly string[]) =>
  args[0] === "pr" ? { stdout: list } : {};

describe("freshen", () => {
  it.effect(
    "merges main up every stack of a named pull request, a shared member once, and gates each top",
    () =>
      Effect.gen(function* () {
        const { origin, work, moved } = yield* fixture();
        const list = yield* listed(origin);
        const { value, calls } = yield* withShell(
          pullList(list),
          freshen(work, [1])
        );
        const head = (number: number) =>
          git(origin, "rev-parse", `refs/heads/b${number}`);
        const [one, two, three, five] = yield* Effect.forEach(
          [1, 2, 3, 5],
          head
        );
        expect(value).toEqual({
          main: moved,
          stacks: [
            {
              stack: 1,
              merged: [1, 2, 3],
              conflict: Option.none(),
              gated: Option.some(three),
            },
            {
              stack: 1,
              merged: [5],
              conflict: Option.none(),
              gated: Option.some(five),
            },
          ],
          missing: [],
        });
        // Each member now contains the head below it, and the bottom today's main.
        const contains = (ancestor: string, sha: string) =>
          git(origin, "merge-base", "--is-ancestor", ancestor, sha).pipe(
            Effect.as(true)
          );
        for (const [ancestor, sha] of [
          [moved, one],
          [one, two],
          [two, three],
          [one, five],
        ] as const) {
          expect(yield* contains(ancestor ?? "", sha ?? "")).toBe(true);
        }
        expect(
          yield* git(origin, "log", "-1", "--format=%s", "refs/heads/b2")
        ).toBe("Merge b1 into b2");
        expect(
          Arr.filter(calls, (call) => call.startsWith("gh workflow run"))
        ).toEqual([
          `gh workflow run proof.yml --repo nakafaai/nakafa.com --ref main -f sha=${three} -f proof=false`,
          `gh workflow run proof.yml --repo nakafaai/nakafa.com --ref main -f sha=${five} -f proof=false`,
        ]);
        // A second run finds every member fresh: it merges and gates nothing.
        const again = yield* withShell(
          pullList(yield* listed(origin)),
          freshen(work, [3, 5])
        );
        expect(Arr.map(again.value.stacks, ({ merged }) => merged)).toEqual([
          [],
          [],
        ]);
        expect(again.calls).toEqual([
          "gh pr list --repo nakafaai/nakafa.com --state open --limit 200 --json number,headRefOid,headRefName,baseRefName,title,isDraft,files",
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "stops a stack at a member whose merge conflicts, names its files, and leaves its branch as it was",
    () =>
      Effect.gen(function* () {
        const { origin, work, moved } = yield* fixture();
        const before = yield* git(origin, "rev-parse", "refs/heads/b4");
        const { value } = yield* withShell(
          pullList(yield* listed(origin)),
          freshen(work, [4, 99])
        );
        expect(value).toEqual({
          main: moved,
          stacks: [
            {
              stack: 4,
              merged: [],
              conflict: Option.some({ number: 4, files: ["readme.md"] }),
              gated: Option.none(),
            },
          ],
          missing: [99],
        });
        expect(yield* git(origin, "rev-parse", "refs/heads/b4")).toBe(before);
        // The command line runs the same, and prints the report.
        const cli = yield* withShell(
          pullList(yield* listed(origin)),
          runFreshenCli(work, ["4"])
        );
        expect(cli.calls).toHaveLength(1);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "fails with Git's words when a merge cannot be built",
    () =>
      Effect.gen(function* () {
        const { origin, work } = yield* fixture();
        const failure = yield* withShell(
          pullList(yield* listed(origin)),
          freshen(work, [4]),
          (args) =>
            args[0] === "merge-tree"
              ? { code: 128, stderr: "fatal: bad object\n" }
              : undefined
        ).pipe(Effect.flip);
        expect(failure.message).toBe(
          "git merge-tree failed on #4: fatal: bad object"
        );
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect("takes one or more pull request numbers", () =>
    Effect.gen(function* () {
      expect(yield* parseFreshenArguments(["2", "5"])).toEqual([2, 5]);
      for (const argv of [[], ["2", "x"], ["0"]]) {
        const failure = yield* parseFreshenArguments(argv).pipe(Effect.flip);
        expect(failure.message).toBe(
          "Usage: bun run freshen <pull-request-number...>"
        );
      }
    })
  );

  it("reports what merged, where a stack stopped, what it gated and what no stack holds", () => {
    expect(
      formatFreshen({
        main: "a".repeat(40),
        stacks: [
          {
            stack: 1,
            merged: [1, 2],
            conflict: Option.none(),
            gated: Option.some("b".repeat(40)),
          },
          {
            stack: 4,
            merged: [4],
            conflict: Option.some({ number: 6, files: ["x.ts", "y.ts"] }),
            gated: Option.none(),
          },
          {
            stack: 7,
            merged: [],
            conflict: Option.none(),
            gated: Option.none(),
          },
        ],
        missing: [9],
      })
    ).toBe(
      Arr.join(
        [
          "Freshened on main aaaaaaaaaa",
          "stack #1: merged #1 #2; gating bbbbbbbbbb",
          "stack #4: merged #4; #6 conflicts in x.ts, y.ts: merge the head below into it by hand, then run freshen again",
          "stack #7: nothing to merge",
          "#9: no open stack holds it",
          "",
        ],
        "\n"
      )
    );
  });
});
