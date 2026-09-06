import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { SEARCH_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { reconcileSearchModel } from "@repo/backend/convex/contentRelease/models/search";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertModelBuild } from "@repo/backend/test/content/model";
import type { WithoutSystemFields } from "convex/server";
import { getDocumentSize } from "convex/values";
import { convexTest } from "convex-test";

type SearchRow = WithoutSystemFields<Doc<"contentIndex">>;

function searchRow(index: number): SearchRow {
  return {
    appLocale: "en",
    contentKey: `material:${String(index).padStart(4, "0")}`,
    family: "material",
    projectionHash: "sha256:projection",
    publicPath: `subject/${index}`,
    releaseId: "active",
    sequence: 1,
    slot: "blue",
    text: "A signed searchable lesson. ".repeat(12),
  };
}

async function setup() {
  const t = convexTest({
    schema,
    modules: convexModules,
    transactionLimits: {
      bytesRead: 2 * 1024 * 1024,
      bytesWritten: 1024 * 1024,
    },
  });
  const build = await t.mutation((ctx) => insertModelBuild(ctx, "search"));
  const advance = (cursor?: string) =>
    t.mutation(async (ctx) => ({
      page: await runConvexProgram(
        reconcileSearchModel(ctx, { ...build, cursor })
      ),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
  return { t, advance };
}

describe("contentRelease/models/search", () => {
  it("keeps unchanged rows and terminates a multi-page merge without model writes", async () => {
    const { t, advance } = await setup();
    const rows = ACTIVE_APP_LOCALE_CODES.flatMap((appLocale) =>
      Array.from({ length: 32 }, (_, index) => ({
        ...searchRow(index),
        appLocale,
      }))
    );
    const count = rows.length;
    await t.mutation(async (ctx) => {
      for (const row of rows) {
        await ctx.db.insert("contentIndex", row);
        await ctx.db.insert("contentIndex", { ...row, slot: "green" });
      }
    });
    const initial = await t.query((ctx) =>
      ctx.db.query("contentIndex").take(count * 2)
    );
    const preparationBytes = initial.reduce(
      (sum, row) => sum + getDocumentSize(row),
      0
    );
    let cursor: string | undefined;
    let pages = 0;
    let bytes = 0;
    let reads = 0;
    do {
      const result = await advance(cursor);
      expect(result.metrics.documentsWritten.used).toBe(0);
      expect(result.page.processed).toBeGreaterThan(0);
      expect(result.page.cursor).not.toBe(cursor);
      bytes += result.metrics.bytesRead.used;
      reads += result.metrics.documentsRead.used;
      pages += 1;
      cursor = result.page.cursor;
    } while (cursor !== undefined && pages < count);
    expect(cursor).toBeUndefined();
    expect(pages).toBeGreaterThan(1);
    expect(pages).toBeLessThan(count);
    expect(reads).toBeLessThan(count * 2 + pages * 3);
    expect(bytes).toBeLessThan(preparationBytes * 1.5);
    await expect(
      t.query((ctx) => ctx.db.query("contentIndex").take(count * 2))
    ).resolves.toEqual(initial);
  });

  it("repairs aborted residue, adds missing identities, and changes only differing rows", async () => {
    const { t, advance } = await setup();
    await t.mutation(async (ctx) => {
      for (let index = 0; index < 50; index += 1) {
        const row = searchRow(index);
        await ctx.db.insert("contentIndex", row);
        if (index !== 8) {
          await ctx.db.insert("contentIndex", {
            ...row,
            slot: "green",
            ...(index === 2 ? { text: "Aborted body", sequence: 9 } : {}),
            ...(index === 18 ? { publicPath: "aborted/path" } : {}),
          });
        }
      }
      await ctx.db.insert("contentIndex", { ...searchRow(52), slot: "green" });
    });
    const first = await advance();
    expect(first.page.done).toBe(false);
    expect(first.metrics.documentsWritten.used).toBe(2);
    const repeated = await advance();
    expect(repeated.page.done).toBe(false);
    expect(repeated.page.processed).toBeGreaterThan(0);
    expect(repeated.metrics.documentsWritten.used).toBe(0);
    let cursor = first.page.cursor;
    let writes = first.metrics.documentsWritten.used;
    while (cursor !== undefined) {
      const result = await advance(cursor);
      writes += result.metrics.documentsWritten.used;
      cursor = result.page.cursor;
    }
    expect(writes).toBe(4);
    const rows = await t.query((ctx) => ctx.db.query("contentIndex").take(101));
    const source = rows.filter((row) => row.slot === "blue");
    const target = rows.filter((row) => row.slot === "green");
    expect(target).toHaveLength(source.length);
    for (const row of source) {
      const { _id, _creationTime, ...fields } = row;
      expect(
        target.find((candidate) => candidate.contentKey === row.contentKey)
      ).toMatchObject({ ...fields, slot: "green" });
    }
  });

  it.each(["source", "target", "both"] as const)(
    "bounds transactions when %s contains maximum-size search bodies",
    async (large) => {
      const { t, advance } = await setup();
      const text = "x".repeat(SEARCH_DOCUMENT_LIMIT - 1024);
      for (let index = 0; index < 12; index += 1) {
        await t.mutation(async (ctx) => {
          const row = searchRow(index);
          await ctx.db.insert("contentIndex", {
            ...row,
            ...(large === "target" ? {} : { text }),
          });
          await ctx.db.insert("contentIndex", {
            ...row,
            ...(large === "source" ? {} : { text }),
            slot: "green",
          });
        });
      }
      let cursor: string | undefined;
      let writes = 0;
      let pages = 0;
      do {
        const result = await advance(cursor);
        expect(result.metrics.bytesRead.used).toBeLessThan(2 * 1024 * 1024);
        expect(result.metrics.bytesWritten.used).toBeLessThan(1024 * 1024);
        writes += result.metrics.documentsWritten.used;
        pages += 1;
        cursor = result.page.cursor;
      } while (cursor !== undefined && pages < 24);
      expect(cursor).toBeUndefined();
      expect(pages).toBeGreaterThan(1);
      expect(writes).toBe(large === "both" ? 0 : 12);
    }
  );

  it.each([
    "an-old-native-cursor",
    JSON.stringify({ version: 2, phase: "search", position: ["a", "en"] }),
    JSON.stringify({
      version: 1,
      phase: "articleCatalog",
      position: ["a", "en"],
    }),
  ])("rejects a cursor outside this phase contract: %s", async (cursor) => {
    const { advance } = await setup();
    await expect(advance(cursor)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it.each(["blue", "green"] as const)(
    "rejects duplicate %s identities and rolls back preceding repairs",
    async (slot) => {
      const { t, advance } = await setup();
      await t.mutation(async (ctx) => {
        await ctx.db.insert("contentIndex", searchRow(0));
        await ctx.db.insert("contentIndex", {
          ...searchRow(0),
          slot: "green",
          text: "Aborted",
        });
        await ctx.db.insert("contentIndex", { ...searchRow(1), slot });
        await ctx.db.insert("contentIndex", { ...searchRow(1), slot });
      });
      await expect(advance()).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
      const rows = await t.query((ctx) => ctx.db.query("contentIndex").take(4));
      expect(rows.find((row) => row.slot === "green")?.text).toBe("Aborted");
    }
  );

  it("completes an empty buffer without inventing a continuation", async () => {
    const { advance } = await setup();
    const result = await advance();
    expect(result.page).toEqual({ done: true, processed: 0 });
    expect(result.metrics.documentsWritten.used).toBe(0);
  });
});
