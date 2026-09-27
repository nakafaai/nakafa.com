import { expect, it } from "@effect/vitest";
import FirecrawlApp from "@mendable/firecrawl-js";
import { readFirecrawlApp } from "@repo/backend/confect/nina/research/provider";
import { searchFirecrawl } from "@repo/backend/confect/nina/research/search/provider";
import { ConfigProvider, Effect, Result } from "effect";

const provider = vi.hoisted(() => ({ fail: false }));
vi.mock("@mendable/firecrawl-js", () => ({
  default: vi.fn(
    class {
      constructor() {
        if (provider.fail) {
          throw new Error("private constructor diagnostic");
        }
      }
    }
  ),
}));

it.effect("keeps research configuration failures typed and secret-free", () =>
  Effect.gen(function* () {
    for (const apiKey of [undefined, "   ", "private-test-key"]) {
      const result = yield* readFirecrawlApp().pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({ FIRECRAWL_API_KEY: apiKey })
          )
        ),
        Effect.result
      );
      if (apiKey?.trim()) {
        expect(Result.isSuccess(result)).toBe(true);
        expect(FirecrawlApp).toHaveBeenLastCalledWith({ apiKey });
      } else {
        expect(Result.isFailure(result) && result.failure._tag).toBe(
          "ResearchProviderError"
        );
      }
    }
    provider.fail = true;
    const failed = yield* readFirecrawlApp().pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({ FIRECRAWL_API_KEY: "private-test-key" })
        )
      ),
      Effect.result
    );
    expect(Result.isFailure(failed) && failed.failure._tag).toBe(
      "ResearchProviderError"
    );
    expect(String(failed)).not.toContain("private");
  })
);

it.effect(
  "reports missing search configuration as an expected retrieval failure",
  () =>
    Effect.gen(function* () {
      const failure = yield* searchFirecrawl("exam source").pipe(
        Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
        Effect.flip
      );
      expect(failure).toMatchObject({
        _tag: "ResearchSearchError",
        message: "Web research is not configured.",
      });
    })
);
