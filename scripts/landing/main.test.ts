import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref, Stdio } from "effect";
import { capture, makeCapture } from "#scripts/capture";
import { parseTrainArguments, runTrainCli } from "#scripts/landing/main";
import { scriptedShell } from "#scripts/test.shell";

const MAIN = "9".repeat(40);

describe("train command line", () => {
  it.effect("reads the pull requests and the specs a train proves", () =>
    Effect.gen(function* () {
      expect(
        yield* parseTrainArguments([
          "12",
          "--specs=e2e/a.browser.ts,e2e/b.browser.ts",
          "7",
        ])
      ).toEqual({
        numbers: [12, 7],
        specs: ["e2e/a.browser.ts", "e2e/b.browser.ts"],
      });
      expect(yield* parseTrainArguments([])).toEqual({
        numbers: [],
        specs: [],
      });
      for (const argv of [["seven"], ["--specs=src/a.ts"], ["0"]]) {
        expect(
          (yield* Effect.flip(parseTrainArguments(argv))).message
        ).toContain("Usage: bun run train");
      }
    })
  );

  it.effect("runs a train on GitHub and prints what it did", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<readonly string[]>([]);
      const stdout = yield* makeCapture;
      yield* runTrainCli("/root", []).pipe(
        Effect.provide(
          Layer.merge(
            scriptedShell((command, args) => {
              if (command === "git") {
                return { stdout: `${MAIN}\trefs/heads/main\n` };
              }
              return command === "gh" && args[0] === "pr"
                ? { stdout: "[]" }
                : undefined;
            }, calls),
            Stdio.layerTest({ stdout: capture(stdout) })
          )
        )
      );
      expect(yield* Ref.get(stdout)).toEqual([
        `Train on main ${MAIN.slice(0, 10)}\nnothing landed, no deploy\n`,
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
