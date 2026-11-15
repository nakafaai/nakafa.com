import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Option } from "effect";
import {
  git,
  origins,
  PROCESS_TIMEOUT,
  STATUS,
  statusOf,
  toJson,
  withRepository,
} from "#scripts/landing/test.repository";
import { Repository } from "#scripts/landing/train";
import { runText } from "#scripts/process";

describe("train repository", () => {
  it.effect(
    "takes the open, ready pull requests whose gate and proof passed",
    () =>
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
                    headRefName: "branch-9",
                    baseRefName: "main",
                    title: "C",
                    isDraft: false,
                    files: [
                      { path: "apps/www/e2e/c/one.browser.ts" },
                      { path: "apps/www/src/c.ts" },
                    ],
                  },
                  {
                    number: 4,
                    headRefOid: "a".repeat(40),
                    headRefName: "branch-4",
                    baseRefName: "main",
                    title: "A",
                    isDraft: false,
                    files: [],
                  },
                  {
                    number: 5,
                    headRefOid: "b".repeat(40),
                    headRefName: "branch-5",
                    baseRefName: "main",
                    title: "B",
                    isDraft: true,
                    files: [],
                  },
                  {
                    number: 7,
                    headRefOid: "e".repeat(40),
                    headRefName: "branch-7",
                    baseRefName: "main",
                    title: "E",
                    isDraft: false,
                    files: [],
                  },
                  {
                    number: 6,
                    headRefOid: "d".repeat(40),
                    headRefName: "branch-6",
                    baseRefName: "main",
                    title: "D",
                    isDraft: false,
                    files: [],
                  },
                ]),
              };
            }
            return {
              stdout: statusOf(String(args[1])),
            };
          },
          Effect.gen(function* () {
            const repository = yield* Repository;
            return {
              all: yield* repository.proven([]),
              named: yield* repository.proven([9]),
              ready: yield* repository.ready([]),
              chosen: yield* repository.ready([6]),
              ungated: yield* repository.ready([7]),
              refused: yield* repository.ready([7, 9, 5, 8]),
              unproven: yield* repository.proven([6]),
            };
          }),
          // Main's tip is f; every head but c contains it.
          (args) => {
            if (args[0] === "ls-remote") {
              return { stdout: `${"f".repeat(40)}\trefs/heads/main\n` };
            }
            if (args[0] === "merge-base") {
              return { code: args[3] === "c".repeat(40) ? 1 : 0 };
            }
            return args[0] === "fetch" ? { stdout: "" } : undefined;
          }
        );
        const numbers = (seats: typeof value.all) =>
          Arr.map(seats.candidates, (one) => one.number);
        expect(numbers(value.all)).toEqual([4, 9]);
        // #9 changes apps/www/src, which the product runs; #4 changes nothing.
        expect(Arr.map(value.all.candidates, (one) => one.runtime)).toEqual([
          false,
          true,
        ]);
        // A batch takes a stack whose own gate passed on a head that contains
        // main, its proof unasked: not #9, gated on an older main, nor #7,
        // whose gate has not passed.
        expect(numbers(value.ready)).toEqual([4, 6]);
        expect(value.ready.refused).toEqual([]);
        expect(numbers(value.chosen)).toEqual([6]);
        expect(numbers(value.named)).toEqual([9]);
        expect(Arr.map(value.named.candidates, (one) => one.specs)).toEqual([
          ["e2e/c/one.browser.ts"],
        ]);
        // A named pull request the train cannot seat says why, and what to run.
        expect(value.ungated.candidates).toEqual([]);
        expect(value.refused.refused).toEqual([
          {
            number: 7,
            reason: `#7, the top of its stack, has no passed gate on eeeeeeeeee: run bun run gate ${"e".repeat(40)}`,
          },
          {
            number: 9,
            reason:
              "#9, the top of its stack, does not contain main ffffffffff: run bun run freshen 9",
          },
          { number: 5, reason: "it is not open, or it is a draft" },
          { number: 8, reason: "it is not open, or it is a draft" },
        ]);
        expect(value.unproven.refused).toEqual([
          {
            number: 6,
            reason:
              "its own gate and proof have not both passed on its head, or on a head above it that carries it",
          },
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "names why a named pull request found no seat: a stack whose top does not carry the member below, or a branch no open pull request holds",
    () =>
      Effect.gen(function* () {
        const listed = (number: number, base: string, head: string) => ({
          number,
          headRefOid: head.repeat(40),
          headRefName: `branch-${number}`,
          baseRefName: base,
          title: `Change ${number}`,
          isDraft: false,
          files: [],
        });
        const { value } = yield* withRepository(
          "/root",
          (args) =>
            args[0] === "pr"
              ? {
                  stdout: toJson([
                    listed(11, "main", "1"),
                    listed(12, "branch-11", "2"),
                    listed(10, "branch-gone", "3"),
                  ]),
                }
              : { stdout: STATUS("success") },
          Effect.gen(function* () {
            const repository = yield* Repository;
            return {
              ready: yield* repository.ready([12, 10]),
              proven: yield* repository.proven([10]),
            };
          }),
          // Every head contains main, but #12 does not carry #11's head.
          (args) => {
            if (args[0] === "ls-remote") {
              return { stdout: `${"f".repeat(40)}\trefs/heads/main\n` };
            }
            if (args[0] === "merge-base") {
              return { code: args[2] === "1".repeat(40) ? 1 : 0 };
            }
            return args[0] === "fetch" ? { stdout: "" } : undefined;
          }
        );
        const orphan = {
          number: 10,
          reason: "it targets branch-gone, which no open pull request holds",
        };
        expect(value.ready).toEqual({
          candidates: [],
          refused: [
            {
              number: 12,
              reason:
                "#12 does not carry every member below it: run bun run freshen 12",
            },
            orphan,
          ],
        });
        expect(value.proven.refused).toEqual([orphan]);
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
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
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
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "carries the members of a stack below its highest proven head, bottom-up",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { work, heads } = yield* origins();
        const [one, two, three] = Arr.map([0, 1, 2], (index) =>
          Option.getOrThrow(Arr.get(heads, index))
        );
        // #4 is built on #1's branch, and #5 targets it without its change.
        yield* git(work, "checkout", "--quiet", "--detach", one.sha);
        yield* fs.writeFileString(`${work}/stack.md`, "four\n");
        yield* git(work, "add", "stack.md");
        yield* git(
          work,
          "-c",
          "user.name=Train",
          "-c",
          "user.email=train@test",
          "commit",
          "--quiet",
          "-m",
          "stack"
        );
        const four = yield* git(work, "rev-parse", "HEAD");
        yield* git(
          work,
          "push",
          "--quiet",
          "origin",
          `${four}:refs/pull/4/head`
        );
        yield* git(
          work,
          "push",
          "--quiet",
          "origin",
          `${two.sha}:refs/pull/5/head`
        );
        const pull = (
          number: number,
          sha: string,
          base: string,
          files: readonly string[] = []
        ) => ({
          number,
          headRefOid: sha,
          headRefName: `branch-${number}`,
          baseRefName: base,
          title: `Change ${number}`,
          isDraft: false,
          files: Arr.map(files, (path) => ({ path })),
        });
        const green = [four, two.sha];
        const { value } = yield* withRepository(
          work,
          (args) => {
            if (args[0] === "pr") {
              return {
                stdout: toJson([
                  pull(5, two.sha, "branch-1"),
                  pull(4, four, "branch-1", ["apps/www/e2e/four.browser.ts"]),
                  pull(3, three.sha, "main"),
                  pull(1, one.sha, "main"),
                ]),
              };
            }
            return {
              stdout: Arr.some(green, (sha) => String(args[1]).includes(sha))
                ? STATUS("success")
                : STATUS("failure"),
            };
          },
          Effect.flatMap(Repository, (repository) => repository.proven([]))
        );
        expect(
          Arr.map(value.candidates, (one) => [one.number, one.specs])
        ).toEqual([
          [1, []],
          [4, ["e2e/four.browser.ts"]],
          [5, []],
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
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
