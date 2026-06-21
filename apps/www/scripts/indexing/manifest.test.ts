import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const sitemapMocks = vi.hoisted(() => ({
  getSitemapEntries: vi.fn(),
}));

vi.mock("@/lib/sitemap/entries", () => ({
  getSitemapEntries: sitemapMocks.getSitemapEntries,
}));

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
      duplicateCount: 1,
      totalEntryCount: 3,
      urls: ["https://nakafa.com/id/home", "https://nakafa.com/id/search"],
    });
  });

  it("builds the manifest from sitemap entries", async () => {
    sitemapMocks.getSitemapEntries.mockReturnValue(
      Effect.succeed([
        { url: "https://nakafa.com/en/home" },
        { url: "https://nakafa.com/id/home" },
        { url: "https://nakafa.com/en/home" },
      ])
    );
    const { getSiteIndexManifest } = await import(
      "@/scripts/indexing/manifest"
    );

    await expect(Effect.runPromise(getSiteIndexManifest())).resolves.toEqual({
      duplicateCount: 1,
      totalEntryCount: 3,
      urls: ["https://nakafa.com/en/home", "https://nakafa.com/id/home"],
    });
  });
});
