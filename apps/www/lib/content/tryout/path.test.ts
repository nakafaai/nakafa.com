// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { Effect, Layer } from "effect";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: runtimeQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
describe("published try-out localized paths", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });
  it.effect.each(APP_LOCALE_CODES)(
    "resolves the signed set and section identity into %s",
    (targetAppLocale) =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        runtimeQueryMock.mockImplementation(context.query);
        for (const publicPath of [
          "try-out/indonesia/tka/matematika-wajib/set-1",
          "try-out/indonesia/tka/matematika-wajib/set-1/matematika-wajib",
        ]) {
          expect(
            yield* readPublishedTryoutLocalizedPath({
              currentAppLocale: "en",
              publicPath,
              targetAppLocale,
            })
          ).toBe(publicPath);
        }
      })
  );
  it.effect("returns no localized route for an absent signed identity", () =>
    Effect.gen(function* () {
      const fixture = yield* makeTryoutRuntimeSource();
      const context = yield* createTestPublication(fixture.source);
      runtimeQueryMock.mockImplementation(context.query);
      expect(
        yield* readPublishedTryoutLocalizedPath({
          currentAppLocale: "id",
          publicPath: "try-out/indonesia/tka/matematika-wajib/missing-set",
          targetAppLocale: "de",
        })
      ).toBeNull();
    })
  );
});
vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
  },
}));
