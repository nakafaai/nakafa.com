// @vitest-environment node

import { assert, beforeEach, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  readPublishedTryoutSitemap,
  readPublishedTryoutSitemapCount,
} from "@/lib/content/tryout/sitemap";

const runtimeQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

describe("published try-out sitemap", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it.effect("reads route inventory and one exact bounded page", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockResolvedValueOnce({ pageCount: 1, routeCount: 2 })
        .mockResolvedValueOnce({ paths: ["try-out/alpha", "try-out/zeta"] });

      assert.deepStrictEqual(yield* readPublishedTryoutSitemapCount("en"), {
        pageCount: 1,
        routeCount: 2,
      });
      assert.deepStrictEqual(yield* readPublishedTryoutSitemap("en", 0), {
        paths: ["try-out/alpha", "try-out/zeta"],
      });
      assert.strictEqual(runtimeQueryMock.mock.calls.length, 2);
      assert.deepStrictEqual(runtimeQueryMock.mock.calls[0]?.[1], {
        appLocale: "en",
      });
      assert.deepStrictEqual(runtimeQueryMock.mock.calls[1]?.[1], {
        appLocale: "en",
        page: 0,
      });
    })
  );

  it.effect(
    "preserves runtime query failures in the Effect error channel",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockRejectedValueOnce(
          new Error("sitemap unavailable")
        );

        const failure = yield* readPublishedTryoutSitemapCount("id").pipe(
          Effect.flip
        );
        assert.strictEqual(failure._tag, "TestRuntimeQueryError");
        assert.strictEqual(failure.message, "Error: sitemap unavailable");
      })
  );
});
