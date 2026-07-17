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
  endPath: "curriculum/fixture/topic-b",
  hash: "page-hash",
  locale: "en",
  page: 0,
  routeCount: 2,
  startPath: "curriculum/fixture/topic-a",
  syncedAt: 1,
};

describe("contentSync public sitemap artifacts", () => {
  it("creates, preserves, updates, and deletes bounded page metadata", async () => {
    const t = convexTest(schema, convexModules);

    const created = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncSitemapPages,
      { pages: [firstPage] }
    );
    const unchanged = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncSitemapPages,
      { pages: [firstPage] }
    );
    const updated = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncSitemapPages,
      {
        pages: [
          {
            ...firstPage,
            endPath: "curriculum/fixture/topic-c",
            hash: "updated-page-hash",
          },
        ],
      }
    );
    const removed = await t.mutation(
      internal.contentSync.publicRoutes.internal.deleteStaleSitemapPages,
      { firstStalePage: 0, locale: "en" }
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(updated).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(removed).toEqual({ deleted: 1 });
  });

  it("commits counts only when count and page count agree", async () => {
    const t = convexTest(schema, convexModules);
    const count: PublicRouteSitemapCount = {
      count: 1001,
      hash: "count-hash",
      locale: "en",
      pageCount: 2,
      syncedAt: 1,
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

    await expect(
      t.mutation(internal.contentSync.publicRoutes.internal.saveSitemapCount, {
        ...count,
        pageCount: 1,
      })
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_COUNT_INVALID" },
    });
  });
});
