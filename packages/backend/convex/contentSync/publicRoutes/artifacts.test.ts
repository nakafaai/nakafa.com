import { internal } from "@repo/backend/convex/_generated/api";
import type {
  PublicRouteSitemapCount,
  PublicRouteSitemapPage,
} from "@repo/backend/convex/contents/sitemap/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const firstPage: PublicRouteSitemapPage = {
  locale: "en",
  page: 0,
  paths: ["curriculum/fixture/topic-a", "curriculum/fixture/topic-b"],
  syncedAt: 1,
};

describe("contentSync public sitemap artifacts", () => {
  it("keeps generation pages immutable and deletes only older generations", async () => {
    const t = convexTest(schema, convexModules);

    const created = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncSitemapPages,
      { pages: [firstPage] }
    );
    const unchanged = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncSitemapPages,
      { pages: [firstPage] }
    );
    await expect(
      t.mutation(internal.contentSync.publicRoutes.internal.syncSitemapPages, {
        pages: [
          {
            ...firstPage,
            paths: ["curriculum/fixture/topic-a", "curriculum/fixture/topic-c"],
          },
        ],
      })
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_GENERATION_COLLISION" },
    });
    const nextGeneration = { ...firstPage, syncedAt: 2 };
    const futureGeneration = { ...firstPage, syncedAt: 3 };
    const nextCreated = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncSitemapPages,
      { pages: [nextGeneration, futureGeneration] }
    );
    const removed = await t.mutation(
      internal.contentSync.publicRoutes.internal.deleteOlderSitemapPages,
      { committedSyncedAt: 2, locale: "en" }
    );
    const remaining = await t.run((ctx) =>
      ctx.db
        .query("publicRouteSitemapPages")
        .withIndex("by_locale_and_syncedAt_and_page", (query) =>
          query.eq("locale", "en")
        )
        .collect()
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(nextCreated).toEqual({ created: 2, unchanged: 0, updated: 0 });
    expect(removed).toEqual({ deleted: 1 });
    expect(remaining.map((page) => page.syncedAt)).toEqual([2, 3]);
  });

  it("commits only valid monotonic generation pointers", async () => {
    const t = convexTest(schema, convexModules);
    const count: PublicRouteSitemapCount = {
      count: 1001,
      hash: "count-hash",
      locale: "en",
      pageCount: 2,
      syncedAt: 2,
    };

    const created = await t.mutation(
      internal.contentSync.publicRoutes.internal.saveSitemapCount,
      count
    );
    const stored = await t.query(
      internal.contentSync.publicRoutes.internal.getSitemapCountState,
      { locale: "en" }
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(stored).toEqual(count);

    const unchanged = await t.mutation(
      internal.contentSync.publicRoutes.internal.saveSitemapCount,
      count
    );
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });

    await expect(
      t.mutation(internal.contentSync.publicRoutes.internal.saveSitemapCount, {
        ...count,
        syncedAt: 1,
      })
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_GENERATION_STALE" },
    });
    await expect(
      t.mutation(internal.contentSync.publicRoutes.internal.saveSitemapCount, {
        ...count,
        hash: "different-hash",
      })
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_GENERATION_COLLISION" },
    });
    await expect(
      t.mutation(internal.contentSync.publicRoutes.internal.saveSitemapCount, {
        ...count,
        pageCount: 1,
      })
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_COUNT_INVALID" },
    });

    const updated = await t.mutation(
      internal.contentSync.publicRoutes.internal.saveSitemapCount,
      { ...count, hash: "new-hash", syncedAt: 3 }
    );
    expect(updated).toEqual({ created: 0, unchanged: 0, updated: 1 });
  });

  it("rejects invalid and oversized exact-path pages", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(internal.contentSync.publicRoutes.internal.syncSitemapPages, {
        pages: [
          {
            ...firstPage,
            paths: ["curriculum/fixture/topic-b", "curriculum/fixture/topic-a"],
          },
        ],
      })
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_PAGE_INVALID" },
    });

    const oversizedPaths = Array.from(
      { length: 1000 },
      (_, index) =>
        `curriculum/${index.toString().padStart(4, "0")}-${"a".repeat(1100)}`
    );
    await expect(
      t.mutation(internal.contentSync.publicRoutes.internal.syncSitemapPages, {
        pages: [{ ...firstPage, paths: oversizedPaths }],
      })
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_PAGE_INVALID" },
    });

    await expect(
      t.mutation(
        internal.contentSync.publicRoutes.internal.deleteOlderSitemapPages,
        { committedSyncedAt: 0, locale: "en" }
      )
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_PAGE_INVALID" },
    });
  });
});
