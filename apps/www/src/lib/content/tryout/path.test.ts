// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { fixtureSetPath } from "@repo/backend/test/assessment/snapshot";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
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
