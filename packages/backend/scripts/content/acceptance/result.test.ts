import { describe, expect, it } from "@effect/vitest";
import {
  combineShards,
  proofFailures,
  reportFailures,
  type ShardResult,
} from "@repo/backend/scripts/content/acceptance/result";
import { Effect } from "effect";

const SHA = "a".repeat(40);

describe("proof results", () => {
  it.effect(
    "reads the failing spec files of nested suites, once each, under apps/www",
    () =>
      Effect.gen(function* () {
        const report = JSON.stringify({
          suites: [
            {
              specs: [{ file: "home/page.browser.ts", ok: true }],
              suites: [
                {
                  specs: [
                    { file: "school/walk.browser.ts", ok: false },
                    { file: "school/walk.browser.ts", ok: false },
                  ],
                },
              ],
            },
            { specs: [{ file: "chat/send.browser.ts", ok: false }] },
            {},
          ],
          errors: [],
        });
        expect(yield* reportFailures("runtime", report)).toEqual([
          "e2e/chat/send.browser.ts",
          "e2e/school/walk.browser.ts",
        ]);
      })
  );

  it.effect("fails the whole suite for an error outside every test", () =>
    Effect.gen(function* () {
      const report = JSON.stringify({ suites: [], errors: [{ message: "x" }] });
      expect(yield* reportFailures("timing", report)).toEqual(["suite:timing"]);
    })
  );

  it("passes an engine only when every shard reported and passed", () => {
    const shard = (
      engine: ShardResult["engine"],
      index: number,
      failures: readonly string[] = []
    ): ShardResult => ({
      engine,
      shard: index,
      passed: failures.length === 0,
      failures,
    });
    const result = combineShards(SHA, "https://run", 2, [
      shard("chromium", 1),
      shard("chromium", 2),
      shard("firefox", 1, ["e2e/b.browser.ts", "e2e/a.browser.ts"]),
      shard("firefox", 2, ["e2e/a.browser.ts"]),
      shard("webkit", 1),
    ]);
    expect(result).toEqual({
      sha: SHA,
      url: "https://run",
      passed: false,
      engines: {
        chromium: { passed: true, failures: [] },
        firefox: {
          passed: false,
          failures: ["e2e/a.browser.ts", "e2e/b.browser.ts"],
        },
        webkit: { passed: false, failures: [] },
      },
    });
    expect(proofFailures(result)).toEqual([
      "e2e/a.browser.ts",
      "e2e/b.browser.ts",
    ]);
    expect(
      combineShards(SHA, "local", 1, [
        shard("chromium", 1),
        shard("firefox", 1),
        shard("webkit", 1),
      ]).passed
    ).toBe(true);
  });
});
