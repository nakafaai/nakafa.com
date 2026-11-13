import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, MutableRef, Option } from "effect";
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
              chosen: yield* repository.ready([7]),
            };
          })
        );
        expect(Arr.map(value.all, (one) => one.number)).toEqual([4, 9]);
        // A batch takes every open pull request that is no draft, proven or not.
        expect(Arr.map(value.ready, (one) => one.number)).toEqual([4, 6, 7, 9]);
        expect(Arr.map(value.chosen, (one) => one.number)).toEqual([7]);
        expect(Arr.map(value.named, (one) => one.number)).toEqual([9]);
        expect(Arr.map(value.named, (one) => one.specs)).toEqual([
          ["e2e/c/one.browser.ts"],
        ]);
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
        expect(Arr.map(value, (one) => [one.number, one.specs])).toEqual([
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

  it.effect(
    "gates a combination on the free runners and reads its verdict, and fails for a head GitHub does not know",
    () =>
      Effect.gen(function* () {
        const sha = "f".repeat(40);
        /** What `gh api graphql --include` prints for a head with these statuses, or for no commit. */
        const look = (contexts: readonly unknown[] | null) => ({
          stdout: Arr.join(
            [
              "HTTP/2.0 200 OK",
              "Date: Fri, 13 Nov 2026 10:00:00 GMT",
              "",
              toJson({
                data: {
                  repository: {
                    object: contexts === null ? null : { status: { contexts } },
                  },
                },
              }),
            ],
            "\r\n"
          ),
        });
        const verdict = (state: string) =>
          look([
            {
              context: "gate",
              state,
              description: null,
              targetUrl: "https://example.test/runs/3",
              createdAt: "2026-11-13T10:20:00Z",
            },
          ]);
        const gated = (answer: { readonly stdout: string }) => {
          const looks = MutableRef.make(0);
          return withRepository(
            "/root",
            (args) => {
              if (args[0] === "workflow") {
                return {};
              }
              return MutableRef.getAndIncrement(looks) === 0
                ? look([])
                : answer;
            },
            Effect.flatMap(Repository, (repository) => repository.gate(sha))
          );
        };
        const passed = yield* gated(verdict("SUCCESS"));
        expect(passed.value).toBe(true);
        expect(
          Arr.filter(passed.calls, (call) => call.startsWith("gh workflow"))
        ).toEqual([
          `gh workflow run gate.yml --repo nakafaai/nakafa.com --ref main -f sha=${sha}`,
        ]);
        expect((yield* gated(verdict("FAILURE"))).value).toBe(false);
        const unknown = yield* withRepository(
          "/root",
          () => look(null),
          Effect.flatMap(Repository, (repository) => repository.gate(sha))
        ).pipe(Effect.flip);
        expect(unknown.message).toBe(
          `GitHub has no commit ${sha}: push it first.`
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );
});
