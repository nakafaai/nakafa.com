import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  Fiber,
  FileSystem,
  MutableRef,
  Option,
  Ref,
  String as Str,
} from "effect";
import { ChildProcess } from "effect/process";
import { TestClock } from "effect/testing";
import {
  CANDIDATE,
  git,
  land,
  origins,
  PROCESS_TIMEOUT,
  view,
  withRepository,
} from "#scripts/landing/test.repository";
import { Repository } from "#scripts/landing/train";
import { collectText } from "#scripts/process";
import { scriptedShell } from "#scripts/test.shell";

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
          [view({ state: "MERGED" }), view({ mergeable: "CONFLICTING" })],
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
          "GitHub reports it conflicting",
          "Pull request is in clean status",
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "waits for GitHub to move a stacked pull request onto main before landing it",
    () =>
      Effect.gen(function* () {
        const views = [view({ baseRefName: "branch-1" }), view()];
        const viewed = MutableRef.make(0);
        const moved = yield* land((args) =>
          args[1] === "view"
            ? (views[MutableRef.getAndIncrement(viewed)] ?? view())
            : {}
        ).pipe(Effect.forkChild);
        const stuck = yield* land((args) =>
          args[1] === "view" ? view({ baseRefName: "branch-1" }) : {}
        ).pipe(Effect.forkChild);
        while (
          moved.pollUnsafe() === undefined ||
          stuck.pollUnsafe() === undefined
        ) {
          yield* TestClock.withLive(Effect.sleep("5 millis"));
          yield* TestClock.adjust("5 seconds");
        }
        expect((yield* Fiber.join(moved)).value).toEqual({
          _tag: "landed",
          candidate: CANDIDATE,
        });
        expect((yield* Fiber.join(stuck)).value).toEqual({
          _tag: "skipped",
          candidate: CANDIDATE,
          reason: "it still targets branch-1: land its base first",
        });
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "lands a head GitHub rebased only when it holds the proven change on today's main",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { work, main, heads } = yield* origins();
        const [one, , three] = Arr.map([0, 1, 2], (index) =>
          Option.getOrThrow(Arr.get(heads, index))
        );
        // Main moves on, and GitHub replays #1 onto it.
        yield* git(work, "checkout", "--quiet", "--detach", main);
        yield* fs.writeFileString(`${work}/later.md`, "later\n");
        yield* git(work, "add", "later.md");
        yield* git(
          work,
          "-c",
          "user.name=Train",
          "-c",
          "user.email=train@test",
          "commit",
          "--quiet",
          "-m",
          "later"
        );
        const later = yield* git(work, "rev-parse", "HEAD");
        yield* git(
          work,
          "push",
          "--quiet",
          "origin",
          `${later}:refs/heads/main`
        );
        const tree = Arr.headNonEmpty(
          Str.split(
            yield* git(work, "merge-tree", "--write-tree", later, one.sha),
            "\n"
          )
        );
        const rebased = yield* git(
          work,
          "commit-tree",
          tree,
          "-p",
          later,
          "-m",
          "replayed"
        );
        yield* git(
          work,
          "push",
          "--quiet",
          "origin",
          `+${rebased}:refs/pull/1/head`
        );
        const landAt = (head: string) =>
          withRepository(
            work,
            (args) => (args[1] === "view" ? view({ headRefOid: head }) : {}),
            Effect.flatMap(Repository, (repository) =>
              repository.land({ ...CANDIDATE, number: 1, sha: one.sha })
            )
          );
        const replayed = yield* landAt(rebased);
        expect(replayed.value._tag).toBe("landed");
        expect(replayed.calls).toContain(
          `gh pr merge 1 --repo nakafaai/nakafa.com --squash --match-head-commit ${rebased} --subject Land me (#1)`
        );
        const other = yield* landAt(three.sha);
        expect(other.value).toMatchObject({
          _tag: "skipped",
          reason: "its head moved after its proof: prove the new head",
        });
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "lands a stacked pull request through the asynchronous merge",
    () =>
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
          args[1] === "merge"
            ? { code: 1, stderr: "asynchronous merge" }
            : view()
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
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
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
