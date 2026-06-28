import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const sitemapMocks = vi.hoisted(() => ({
  getSitemapEntries: vi.fn(),
  readSitemapPageDescriptors: vi.fn(),
}));

vi.mock("@/lib/sitemap/entries", () => ({
  getSitemapEntries: sitemapMocks.getSitemapEntries,
}));

vi.mock("@/lib/sitemap/routes", () => ({
  readSitemapPageDescriptors: sitemapMocks.readSitemapPageDescriptors,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildSiteIndexManifest", () => {
  it("deduplicates and sorts canonical sitemap URLs", async () => {
    const { buildSiteIndexManifest } = await import(
      "@/scripts/indexing/manifest"
    );

    expect(
      buildSiteIndexManifest([
        "https://nakafa.com/id/search",
        "https://nakafa.com/id/home",
        "https://nakafa.com/id/search",
      ])
    ).toEqual({
      batchCount: 1,
      canonicalUrlCount: 2,
      duplicateCount: 1,
      totalEntryCount: 3,
      urls: ["https://nakafa.com/id/home", "https://nakafa.com/id/search"],
    });
  });

  it("reports an empty manifest when no canonical sitemap URL exists", async () => {
    const { buildSiteIndexManifest } = await import(
      "@/scripts/indexing/manifest"
    );

    expect(buildSiteIndexManifest([])).toEqual({
      batchCount: 0,
      canonicalUrlCount: 0,
      duplicateCount: 0,
      totalEntryCount: 0,
      urls: [],
    });
  });

  it("builds the manifest from sitemap entries", async () => {
    sitemapMocks.readSitemapPageDescriptors.mockReturnValue(
      Effect.succeed([{ id: "public_id" }, { id: "public_en" }])
    );
    sitemapMocks.getSitemapEntries
      .mockReturnValueOnce(
        Effect.succeed([
          { url: "https://nakafa.com/en/home" },
          { url: "https://nakafa.com/id/home" },
        ])
      )
      .mockReturnValueOnce(
        Effect.succeed([{ url: "https://nakafa.com/en/home" }])
      );
    const { getSiteIndexManifest } = await import(
      "@/scripts/indexing/manifest"
    );

    await expect(Effect.runPromise(getSiteIndexManifest())).resolves.toEqual({
      batchCount: 1,
      canonicalUrlCount: 2,
      duplicateCount: 1,
      totalEntryCount: 3,
      urls: ["https://nakafa.com/en/home", "https://nakafa.com/id/home"],
    });
  });

  it("streams canonical sitemap URLs through bounded batches", async () => {
    sitemapMocks.readSitemapPageDescriptors.mockReturnValue(
      Effect.succeed([{ id: "public_id" }, { id: "public_en" }])
    );
    sitemapMocks.getSitemapEntries
      .mockReturnValueOnce(
        Effect.succeed([
          { url: "https://nakafa.com/id/home" },
          { url: "https://nakafa.com/id/search" },
        ])
      )
      .mockReturnValueOnce(
        Effect.succeed([
          { url: "https://nakafa.com/id/home" },
          { url: "https://nakafa.com/en/home" },
        ])
      );
    const { forEachSiteIndexUrlBatch } = await import(
      "@/scripts/indexing/manifest"
    );
    const batches: string[][] = [];

    const summary = await Effect.runPromise(
      forEachSiteIndexUrlBatch(
        (batch) =>
          Effect.sync(() => {
            batches.push([...batch.urls]);
          }),
        { batchSize: 2 }
      )
    );

    expect(summary).toEqual({
      batchCount: 2,
      canonicalUrlCount: 3,
      duplicateCount: 1,
      totalEntryCount: 4,
    });
    expect(batches).toEqual([
      ["https://nakafa.com/id/home", "https://nakafa.com/id/search"],
      ["https://nakafa.com/en/home"],
    ]);
  });

  it("returns an empty summary without invoking the batch processor", async () => {
    sitemapMocks.readSitemapPageDescriptors.mockReturnValue(
      Effect.succeed([{ id: "public_id" }])
    );
    sitemapMocks.getSitemapEntries.mockReturnValueOnce(Effect.succeed([]));
    const { forEachSiteIndexUrlBatch } = await import(
      "@/scripts/indexing/manifest"
    );
    const processBatch = vi.fn(() => Effect.void);

    const summary = await Effect.runPromise(
      forEachSiteIndexUrlBatch(processBatch)
    );

    expect(summary).toEqual({
      batchCount: 0,
      canonicalUrlCount: 0,
      duplicateCount: 0,
      totalEntryCount: 0,
    });
    expect(processBatch).not.toHaveBeenCalled();
  });
});
