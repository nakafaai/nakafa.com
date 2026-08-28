import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

const sitemapMocks = vi.hoisted(() => ({
  getSitemapEntries: vi.fn(),
  readSitemapPageDescriptors: vi.fn(),
}));

vi.mock("@/lib/sitemap/entries", () => ({
  getSitemapEntries: sitemapMocks.getSitemapEntries,
}));

vi.mock("@/lib/sitemap/catalog", () => ({
  readSitemapPageDescriptors: sitemapMocks.readSitemapPageDescriptors,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("forEachSiteIndexUrlBatch", () => {
  it.effect("streams canonical sitemap URLs through bounded batches", () =>
    Effect.gen(function* () {
      sitemapMocks.readSitemapPageDescriptors.mockReturnValue(
        Effect.succeed([{ id: "public_id_0" }, { id: "public_en_0" }])
      );
      sitemapMocks.getSitemapEntries
        .mockReturnValueOnce(
          Effect.succeed([
            { url: "https://nakafa.com/id/home" },
            { url: "https://nakafa.com/id/search" },
          ])
        )
        .mockReturnValueOnce(
          Effect.succeed([{ url: "https://nakafa.com/en/home" }])
        );
      const { forEachSiteIndexUrlBatch } = yield* Effect.promise(
        () => import("@/scripts/indexing/manifest")
      );
      const batches: string[][] = [];

      const summary = yield* forEachSiteIndexUrlBatch(
        (batch) =>
          Effect.sync(() => {
            batches.push([...batch.urls]);
          }),
        { batchSize: 2 }
      );

      expect(summary).toEqual({
        batchCount: 2,
        canonicalUrlCount: 3,
      });
      expect(batches).toEqual([
        ["https://nakafa.com/id/home", "https://nakafa.com/id/search"],
        ["https://nakafa.com/en/home"],
      ]);
    })
  );

  it.effect(
    "returns an empty summary without invoking the batch processor",
    () =>
      Effect.gen(function* () {
        sitemapMocks.readSitemapPageDescriptors.mockReturnValue(
          Effect.succeed([{ id: "public_id_0" }])
        );
        sitemapMocks.getSitemapEntries.mockReturnValueOnce(Effect.succeed([]));
        const { forEachSiteIndexUrlBatch } = yield* Effect.promise(
          () => import("@/scripts/indexing/manifest")
        );
        const processBatch = vi.fn(() => Effect.void);

        const summary = yield* forEachSiteIndexUrlBatch(processBatch);

        expect(summary).toEqual({
          batchCount: 0,
          canonicalUrlCount: 0,
        });
        expect(processBatch).not.toHaveBeenCalled();
      })
  );
});
