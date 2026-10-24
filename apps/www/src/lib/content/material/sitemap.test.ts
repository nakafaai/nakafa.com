// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { Array as Arr, Effect, Layer, Order } from "effect";
import {
  readPublishedMaterialBuckets,
  readPublishedMaterialSitemap,
} from "@/lib/content/material/sitemap";
import { activateTestRelease } from "@/test/active";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { resetTestRuntimeCache } from "@/test/store";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");
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
beforeEach(() => {
  runtimeQueryMock.mockReset();
  resetTestRuntimeCache();
  activateTestRelease(activeReleaseId);
});
describe("published material sitemap", () => {
  it.effect(
    "asks Convex once for the buckets and each partition of a release",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockImplementation((reference) =>
          Effect.succeed(
            reference.convexFunctionName.endsWith("sitemapBuckets")
              ? {
                  activeReleaseId,
                  buckets: ["abc"],
                  managed: true,
                  materialCount: 1,
                }
              : {
                  routes: [
                    {
                      lastModified: "2026-07-25",
                      publicPath: "subjects/mathematics/functions",
                    },
                  ],
                }
          )
        );

        for (const _ of [1, 2, 3]) {
          yield* readPublishedMaterialBuckets("en");
          yield* readPublishedMaterialSitemap("en", ["abc"]);
        }
        expect(runtimeQueryMock).toHaveBeenCalledTimes(2);

        activateTestRelease("release-material-next");
        yield* readPublishedMaterialBuckets("en");
        yield* readPublishedMaterialSitemap("en", ["abc"]);
        yield* readPublishedMaterialSitemap("en", ["abc", "def"]);
        expect(runtimeQueryMock).toHaveBeenCalledTimes(5);
      })
  );
  it.effect(
    "enumerates every localized route through authenticated bucket reads",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        runtimeQueryMock.mockImplementation(context.query);
        const inventory = yield* readPublishedMaterialBuckets("de");
        const pages = yield* Effect.forEach(inventory.buckets, (bucket) =>
          readPublishedMaterialSitemap("de", [bucket]).pipe(
            Effect.flatMap(Effect.fromNullishOr)
          )
        );
        expect(inventory).toMatchObject({
          activeReleaseId: fixture.state.activeReleaseId,
          materialCount: 2,
        });
        expect(
          Arr.sort(
            Arr.flatMap(pages, (page) =>
              Arr.map(page.routes, (row) => row.publicPath)
            ),
            Order.String
          )
        ).toEqual(
          Arr.sort(
            Arr.map(
              Arr.filter(fixture.projections, (row) => row.appLocale === "de"),
              (row) => row.publicPath
            ),
            Order.String
          )
        );
      })
  );
  it.effect("decodes the release identity and reads one sitemap page", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId,
            buckets: ["abc"],
            managed: true,
            materialCount: 1,
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            routes: [
              {
                lastModified: "2025-04-27",
                publicPath:
                  "subjects/mathematics/function-composition-inverse-function/function-concept",
              },
            ],
          })
        );
      expect(yield* readPublishedMaterialBuckets("en")).toEqual({
        activeReleaseId,
        buckets: ["abc"],
        materialCount: 1,
      });
      expect(yield* readPublishedMaterialSitemap("en", ["abc"])).toMatchObject({
        routes: [
          {
            lastModified: "2025-04-27",
          },
        ],
      });
    })
  );
  it.effect("rejects invalid and unmanaged material inventories", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: "",
            buckets: [],
            managed: false,
            materialCount: 0,
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId,
            buckets: [],
            managed: false,
            materialCount: 0,
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: null,
            buckets: [],
            managed: true,
            materialCount: 0,
          })
        );
      // Each attempt asks for another locale, because an answer that can be
      // stored is answered from the store the second time.
      for (const locale of ["en", "id", "de"] as const) {
        const failure = yield* readPublishedMaterialBuckets(locale).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "PublishedProjectionError",
        });
      }
    })
  );
});
