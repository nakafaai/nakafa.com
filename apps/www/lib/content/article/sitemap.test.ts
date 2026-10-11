import { HttpClient } from "@confect/js";
// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { Array as Arr, Effect, Layer, Order } from "effect";
import {
  readPublishedArticleBuckets,
  readPublishedArticleSitemap,
} from "@/lib/content/article/sitemap";
import { activateTestRelease } from "@/test/active";
import { makeArticleRuntimeSource } from "@/test/content/article";
import { resetTestRuntimeCache } from "@/test/store";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-article");
vi.mock(
  "@vercel/functions",
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
describe("published article sitemap", () => {
  it.effect(
    "enumerates signed article and category routes through serving buckets",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeArticleRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        runtimeQueryMock.mockImplementation(context.query);
        const inventory = yield* readPublishedArticleBuckets("de");
        const pages = yield* Effect.forEach(inventory.buckets, (bucket) =>
          readPublishedArticleSitemap("de", bucket)
        );
        expect(inventory).toMatchObject({
          activeReleaseId: fixture.state.activeReleaseId,
          articleCount: 2,
        });
        expect(
          Arr.sort(
            Arr.flatMap(pages, (page) => {
              if (page === null) {
                return expect.fail("A declared article bucket must exist.");
              }
              return Arr.map(page.routes, (row) => row.publicPath);
            }),
            Order.String
          )
        ).toEqual([
          "articles/politik",
          "articles/politik/artikel-1",
          "articles/politik/artikel-2",
        ]);
      })
  );
  beforeEach(() => {
    runtimeQueryMock.mockReset();
    resetTestRuntimeCache();
    activateTestRelease(activeReleaseId);
  });
  it.effect(
    "asks Convex once for the buckets and each partition of a release",
    () =>
      Effect.gen(function* () {
        const nextReleaseId = ReleaseIdSchema.make("release-article-next");
        runtimeQueryMock.mockImplementation((reference) =>
          Effect.succeed(
            reference.convexFunctionName.endsWith("sitemapBuckets")
              ? {
                  activeReleaseId,
                  articleCount: 1,
                  buckets: ["abc"],
                  managed: true,
                }
              : { routes: [{ publicPath: "articles/politics/article" }] }
          )
        );

        for (const _ of [1, 2, 3]) {
          yield* readPublishedArticleBuckets("en");
          yield* readPublishedArticleSitemap("en", "abc");
        }
        expect(runtimeQueryMock).toHaveBeenCalledTimes(2);

        activateTestRelease(nextReleaseId);
        yield* readPublishedArticleBuckets("en");
        yield* readPublishedArticleSitemap("en", "abc");
        yield* readPublishedArticleSitemap("en", "def");
        expect(runtimeQueryMock).toHaveBeenCalledTimes(5);
      })
  );
  it.effect("reads bucket discovery and one exact route partition", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId,
            articleCount: 1,
            buckets: ["abc"],
            managed: true,
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            routes: [
              {
                lastModified: "2026-07-23",
                publicPath: "articles/politics/article",
              },
            ],
          })
        );
      const buckets = yield* readPublishedArticleBuckets("en");
      expect(buckets).toEqual({
        activeReleaseId,
        articleCount: 1,
        buckets: ["abc"],
      });
      const sitemap = yield* readPublishedArticleSitemap("en", "abc");
      expect(sitemap).toMatchObject({
        routes: [
          {
            publicPath: "articles/politics/article",
          },
        ],
      });
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(1, expect.anything(), {
        appLocale: "en",
      });
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
        appLocale: "en",
        bucket: "abc",
      });
    })
  );
  it.effect("rejects an unmanaged article sitemap inventory", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: null,
          articleCount: 0,
          buckets: [],
          managed: false,
        })
      );
      const error = yield* readPublishedArticleBuckets("en").pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "PublishedProjectionError",
      });
    })
  );
  it.effect(
    "preserves runtime query failures in the Effect error channel",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockReturnValueOnce(
          Effect.fail(
            new HttpClient.HttpClientError({
              cause: new Error("sitemap unavailable"),
            })
          )
        );
        const error = yield* readPublishedArticleBuckets("id").pipe(
          Effect.flip
        );
        expect(error).toMatchObject({
          _tag: "HttpClientError",
          cause: expect.objectContaining({ message: "sitemap unavailable" }),
        });
      })
  );
  it.effect("rejects a sitemap inventory from another signed release", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-next",
          articleCount: 1,
          buckets: ["abc"],
          managed: true,
        })
      );
      const error = yield* readPublishedArticleBuckets(
        "de",
        activeReleaseId
      ).pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
      });
    })
  );
});
