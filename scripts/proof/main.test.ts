import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Layer, Ref } from "effect";
import { parseProofArguments, runProof } from "#scripts/proof/main";
import {
  github,
  MAIN,
  PROCESS_TIMEOUT,
  RUN,
  SHA,
  shard,
  withGithub,
} from "#scripts/proof/test.github";
import { scriptedShell } from "#scripts/test.shell";

describe("proof command line", () => {
  it.effect("reads where, which head, which specs and how many machines", () =>
    Effect.gen(function* () {
      expect(
        yield* parseProofArguments([SHA, "e2e/a.browser.ts", "--shards=2"])
      ).toEqual({
        local: false,
        shards: 2,
        sha: SHA,
        specs: ["e2e/a.browser.ts"],
      });
      expect(yield* parseProofArguments(["--local", SHA])).toEqual({
        local: true,
        shards: 3,
        sha: SHA,
        specs: [],
      });
      expect(
        (yield* parseProofArguments([SHA, "e2e/a.browser.ts"])).shards
      ).toBe(1);
      for (const argv of [
        [],
        ["main"],
        [SHA, "--shards=9"],
        [SHA, "src/a.ts"],
      ]) {
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
        const remote = yield* withGithub(
          github({
            "result-chromium-1": shard("chromium"),
            "result-firefox-1": shard("firefox"),
            "result-webkit-1": shard("webkit"),
          }),
          runProof("/root", [SHA, "--shards=1"]).pipe(
            Effect.provide(Layer.empty)
          )
        );
        expect(yield* remote.exit).toBe(0);
        const failing = yield* withGithub(
          github(undefined),
          runProof("/root", [SHA])
        );
        expect(yield* failing.exit).toBe(1);

        const red = {
          "result-chromium-1": shard("chromium", ["e2e/a.browser.ts"]),
          "result-firefox-1": shard("firefox", ["e2e/b.browser.ts"]),
          "result-webkit-1": shard("webkit"),
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
            "result-chromium-1": shard("chromium", ["e2e/a.browser.ts"]),
            "result-firefox-1": shard("firefox"),
            "result-webkit-1": shard("webkit"),
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
            "result-chromium-1": shard("chromium"),
            "result-firefox-1": shard("firefox"),
            "result-webkit-1": shard("webkit"),
          }),
          runProof("/root", [MAIN, "--shards=1"])
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
