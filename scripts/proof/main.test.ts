import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Layer, Ref } from "effect";
import { parseProofArguments, runProof } from "#scripts/proof/main";
import {
  github,
  JOB,
  MAIN,
  PROCESS_TIMEOUT,
  RUN,
  SHA,
  shard,
  step,
  withGithub,
} from "#scripts/proof/test.github";
import { scriptedShell } from "#scripts/test.shell";

describe("proof command line", () => {
  it.effect("reads where, which head and which specs", () =>
    Effect.gen(function* () {
      expect(yield* parseProofArguments([SHA, "e2e/a.browser.ts"])).toEqual({
        local: false,
        sha: SHA,
        specs: ["e2e/a.browser.ts"],
      });
      expect(yield* parseProofArguments(["--local", SHA])).toEqual({
        local: true,
        sha: SHA,
        specs: [],
      });
      for (const argv of [[], ["main"], [SHA, "src/a.ts"]]) {
        expect(
          (yield* Effect.flip(parseProofArguments(argv))).message
        ).toContain("Usage: bun run proof");
      }
    })
  );

  it.effect(
    "proves on GitHub, or here through the acceptance runtime",
    () =>
      Effect.gen(function* () {
        const green = {
          chromium: shard("chromium"),
          firefox: shard("firefox"),
          webkit: shard("webkit"),
        };
        const remote = yield* withGithub(
          github(green),
          runProof("/root", [SHA]).pipe(Effect.provide(Layer.empty))
        );
        expect(yield* remote.exit).toBe(0);
        expect(
          Arr.some(remote.calls, (call) =>
            call.includes(`-f sha=${SHA} -f specs= -f gate=true -f full=false`)
          )
        ).toBe(true);
        // A head whose gate failed is not ready, whatever its browsers say.
        const ungated = yield* withGithub(
          github(green, {
            ...RUN,
            jobs: [
              {
                ...JOB,
                steps: [step("Gate static", 5, 12, "failure"), ...JOB.steps],
              },
            ],
          }),
          runProof("/root", [SHA])
        );
        expect(yield* ungated.exit).toBe(1);
        const failing = yield* withGithub(
          github(undefined),
          runProof("/root", [SHA])
        );
        expect(yield* failing.exit).toBe(1);

        const red = {
          chromium: shard("chromium", ["e2e/a.browser.ts"]),
          firefox: shard("firefox", ["e2e/b.browser.ts"]),
          webkit: shard("webkit"),
        };
        const sharedWithMain = yield* withGithub(
          github(red, RUN, red),
          runProof("/root", [SHA])
        );
        expect(yield* sharedWithMain.exit).toBe(0);
        expect(sharedWithMain.calls).toContain(
          `gh api --silent repos/nakafaai/nakafa.com/statuses/${SHA} -f state=success -f context=proof/new -f target_url=${RUN.url} -f description=No new failure; 2 fail on main ${MAIN.slice(0, 10)} too`
        );
        const newOnHead = yield* withGithub(
          github(red, RUN, {
            chromium: shard("chromium", ["e2e/a.browser.ts"]),
            firefox: shard("firefox"),
            webkit: shard("webkit"),
          }),
          runProof("/root", [SHA])
        );
        expect(yield* newOnHead.exit).toBe(1);
        expect(
          Arr.some(newOnHead.calls, (call) =>
            call.includes("state=failure -f context=proof/new")
          )
        ).toBe(true);
        const onMain = yield* withGithub(github({}), runProof("/root", [MAIN]));
        expect(yield* onMain.exit).toBe(1);
        expect(
          Arr.some(onMain.calls, (call) => call.includes("context=proof/new"))
        ).toBe(false);
        const greenMain = yield* withGithub(
          github({
            chromium: shard("chromium"),
            firefox: shard("firefox"),
            webkit: shard("webkit"),
          }),
          runProof("/root", [MAIN])
        );
        expect(yield* greenMain.exit).toBe(0);
        const answer = github({});
        const nameless = yield* withGithub(
          (args) => (args[0] === "api" ? { stdout: "main\n" } : answer(args)),
          runProof("/root", [SHA])
        );
        expect((yield* Effect.flip(nameless.exit)).message).toBe(
          "GitHub named no main head."
        );

        const calls = yield* Ref.make<readonly string[]>([]);
        const code = yield* runProof("/root", [
          "--local",
          SHA,
          "e2e/a.browser.ts",
        ]).pipe(
          Effect.provide(
            scriptedShell(
              (command) => (command === "bun" ? { code: 3 } : undefined),
              calls
            )
          )
        );
        expect(code).toBe(3);
        expect(yield* Ref.get(calls)).toEqual([
          `bun run --cwd packages/backend acceptance proof ${SHA} e2e/a.browser.ts`,
        ]);
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );
});
