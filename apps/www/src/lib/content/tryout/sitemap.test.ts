// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { fixtureSetPath } from "@repo/backend/test/assessment/snapshot";
import { client } from "@repo/backend/test/client";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Layer } from "effect";
import {
  readPublishedTryoutSitemap,
  readPublishedTryoutSitemapCount,
} from "@/lib/content/tryout/sitemap";
import { activateTestRelease } from "@/test/active";
import { resetTestRuntimeCache } from "@/test/store";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
vi.mock(
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
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
describe("published try-out sitemap", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
    resetTestRuntimeCache();
    activateTestRelease("release-tryout");
  });
  it.effect("asks Convex once for the count and each page of a release", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockImplementation((reference) =>
        Effect.succeed(
          reference.convexFunctionName.endsWith("sitemapCount")
            ? { pageCount: 1, routeCount: 1 }
            : { paths: ["try-out/indonesia"] }
        )
      );

      for (const _ of [1, 2, 3]) {
        yield* readPublishedTryoutSitemapCount("en");
        yield* readPublishedTryoutSitemap("en", 0);
      }
      expect(runtimeQueryMock).toHaveBeenCalledTimes(2);

      activateTestRelease("release-tryout-next");
      yield* readPublishedTryoutSitemapCount("en");
      yield* readPublishedTryoutSitemap("en", 0);
      expect(runtimeQueryMock).toHaveBeenCalledTimes(4);
    })
  );
  it.effect.each(APP_LOCALE_CODES)(
    "reads the complete %s route inventory",
    (locale) =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        runtimeQueryMock.mockImplementation(world.visitor.query);
        const set = fixtureSetPath("set-1", locale);
        expect(yield* readPublishedTryoutSitemapCount(locale)).toEqual({
          pageCount: 1,
          routeCount: 6,
        });
        expect(yield* readPublishedTryoutSitemap(locale, 0)).toEqual({
          paths: [
            `try-out/indonesia-${locale}`,
            `try-out/indonesia/snbt-${locale}`,
            `try-out/indonesia/snbt/2027-${locale}`,
            set,
            `${set}/section-a`,
            `${set}/section-b`,
          ],
        });
        expect(yield* readPublishedTryoutSitemap(locale, 1)).toBeNull();
        expect(yield* readPublishedTryoutSitemap(locale, -1)).toBeNull();
      })
  );
  it.effect("fails closed when no release is active", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockImplementation(
        client(createConvexTestWithBetterAuth()).query
      );
      expect(
        yield* readPublishedTryoutSitemapCount("id").pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_MISSING",
      });
    })
  );
});
