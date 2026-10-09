import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, MutableList } from "effect";

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

beforeEach(() => {
  sitemapMocks.getSitemapEntries.mockReset();
  sitemapMocks.readSitemapPageDescriptors.mockReset();
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
      const batches = MutableList.make<string[]>();

      const summary = yield* forEachSiteIndexUrlBatch(
        (batch) =>
          Effect.sync(() => {
            MutableList.append(batches, [...batch.urls]);
            return false;
          }),
        { batchSize: 2 }
      );

      expect(summary).toEqual({
        batchCount: 2,
        canonicalUrlCount: 3,
      });
      expect(MutableList.toArray(batches)).toEqual([
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
        const processBatch = vi.fn(() => Effect.succeed(false));

        const summary = yield* forEachSiteIndexUrlBatch(processBatch);

        expect(summary).toEqual({
          batchCount: 0,
          canonicalUrlCount: 0,
        });
        expect(processBatch).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "ends the pass after the batch that asks to stop, and counts only the batches read",
    () =>
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
        const batches = MutableList.make<string[]>();

        const summary = yield* forEachSiteIndexUrlBatch(
          (batch) =>
            Effect.sync(() => {
              MutableList.append(batches, [...batch.urls]);
              return true;
            }),
          { batchSize: 2 }
        );

        expect(summary).toEqual({
          batchCount: 1,
          canonicalUrlCount: 2,
        });
        expect(MutableList.toArray(batches)).toEqual([
          ["https://nakafa.com/id/home", "https://nakafa.com/id/search"],
        ]);
        expect(sitemapMocks.getSitemapEntries).toHaveBeenCalledOnce();
      })
  );
});
