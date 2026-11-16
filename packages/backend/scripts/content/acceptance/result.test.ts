import { describe, expect, it } from "@effect/vitest";
import {
  combineShards,
  proofFailures,
  reportFailures,
  type ShardResult,
} from "@repo/backend/scripts/content/acceptance/result";
import { Effect, Schema } from "effect";

const SHA = "a".repeat(40);

const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const NESTED_REPORT = toJson({
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

const ERROR_REPORT = toJson({ suites: [], errors: [{ message: "x" }] });

describe("proof results", () => {
  it.effect(
    "reads the failing spec files of nested suites, once each, under apps/www",
    () =>
      Effect.gen(function* () {
        expect(yield* reportFailures("runtime", NESTED_REPORT)).toEqual([
          "e2e/chat/send.browser.ts",
          "e2e/school/walk.browser.ts",
        ]);
      })
  );

  it.effect("fails the whole suite for an error outside every test", () =>
    Effect.gen(function* () {
      expect(yield* reportFailures("timing", ERROR_REPORT)).toEqual([
        "suite:timing",
      ]);
    })
  );

  it("passes an engine only when every shard it names reported and passed", () => {
    const shard = (
      engine: ShardResult["engine"],
      index: number,
      total: number,
      failures: readonly string[] = []
    ): ShardResult => ({
      engine,
      shard: index,
      total,
      passed: failures.length === 0,
      failures,
    });
    const result = combineShards(SHA, "https://run", [
      shard("chromium", 1, 2),
      shard("chromium", 2, 2),
      shard("firefox", 1, 2, ["e2e/b.browser.ts", "e2e/a.browser.ts"]),
      shard("firefox", 2, 2, ["e2e/a.browser.ts"]),
      shard("webkit", 1, 2),
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
    // Each engine has the shards its own selection gave it, and an engine whose
    // machines disagree on their number never passes.
    expect(
      combineShards(SHA, "local", [
        shard("chromium", 1, 1),
        shard("firefox", 1, 3),
        shard("firefox", 2, 3),
        shard("firefox", 3, 3),
        shard("webkit", 1, 1),
      ]).passed
    ).toBe(true);
    expect(
      combineShards(SHA, "local", [
        shard("chromium", 1, 1),
        shard("firefox", 1, 1),
        shard("webkit", 1, 2),
        shard("webkit", 2, 1),
      ]).engines.webkit.passed
    ).toBe(false);
  });
});
