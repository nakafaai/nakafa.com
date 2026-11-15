// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { fixtureSetPath } from "@repo/backend/test/assessment/catalog";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Layer } from "effect";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";
import { activateTestRelease } from "@/test/active";
import { resetTestRuntimeCache } from "@/test/store";

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
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
vi.mock(
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
/** The locales the fixture's one set is written in: no node of it serves Malay. */
const SERVED_LOCALES = ["en", "id", "de"] as const;

describe("published try-out localized paths", () => {
  beforeEach(() => {
    resetTestRuntimeCache();
    activateTestRelease("release-tryout");
    runtimeQueryMock.mockReset();
  });
  it.effect.each(SERVED_LOCALES)(
    "resolves the set and section identity into %s",
    (targetAppLocale) =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        runtimeQueryMock.mockImplementation(world.visitor.query);
        const set = fixtureSetPath("set-1", "en");
        const target = fixtureSetPath("set-1", targetAppLocale);
        for (const [publicPath, localized] of [
          [set, target],
          [`${set}/section-a`, `${target}/section-a`],
        ] as const) {
          expect(
            yield* readPublishedTryoutLocalizedPath({
              currentAppLocale: "en",
              publicPath,
              targetAppLocale,
            })
          ).toBe(localized);
        }
      })
  );
  it.effect(
    "leads to the try-out hub in a locale the set is not written in",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        runtimeQueryMock.mockImplementation(world.visitor.query);
        expect(
          yield* readPublishedTryoutLocalizedPath({
            currentAppLocale: "en",
            publicPath: fixtureSetPath("set-1", "en"),
            targetAppLocale: "ms",
          })
        ).toBe("try-out");
      })
  );
  it.effect("returns no localized route for an absent identity", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      runtimeQueryMock.mockImplementation(world.visitor.query);
      expect(
        yield* readPublishedTryoutLocalizedPath({
          currentAppLocale: "id",
          publicPath: "try-out/indonesia/snbt/2027/missing-set",
          targetAppLocale: "de",
        })
      ).toBeNull();
    })
  );
});
