import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  QURAN_SEARCH_DOCUMENT_READ_LIMIT,
  QURAN_SEARCH_RESULT_LIMIT,
} from "@repo/backend/confect/contentRelease/quran/limits";
import { readTextCandidates } from "@repo/backend/confect/contents/helpers/search/quran/candidates";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contents/helpers/search/quran/candidates", () => {
  it("stops overlap expansion while preserving enough reads to authenticate selected results", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        Array.from(
          {
            length: QURAN_SEARCH_RESULT_LIMIT,
          },
          (_, index) =>
            makeQuranSearch(
              "en",
              index + 1,
              index < 6
                ? "primary secondary tertiary quaternary"
                : "secondary tertiary quaternary"
            )
        )
      )
    );
    const { result, metrics } = await t.query(async (ctx) => ({
      result: await Effect.runPromise(
        readTextCandidates(
          snapshotId,
          "en",
          ["primary", "secondary", "tertiary", "quaternary"],
          new Set(),
          0,
          QURAN_SEARCH_RESULT_LIMIT
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      ),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    expect(result.rows).toHaveLength(6);
    expect(new Set(result.rows.map((row) => row.identity)).size).toBe(6);
    expect(metrics.documentsRead.used + result.rows.length).toBeLessThanOrEqual(
      QURAN_SEARCH_DOCUMENT_READ_LIMIT
    );
  });
  it("preserves prefix matching for every alternate text variant", async () => {
    const target = convexTest(schema, convexModules);
    const snapshotId = await target.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSearch("en", 1, "mercy guidance"),
        makeQuranSearch("en", 2, "wisdom lesson"),
      ])
    );
    const result = await target.query((ctx) =>
      Effect.runPromise(
        readTextCandidates(
          snapshotId,
          "en",
          ["merc", "wisd"],
          new Set(),
          0,
          2
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      )
    );
    expect(result.rows.map(({ surahNumber }) => surahNumber)).toEqual([1, 2]);
  });
  it("reserves capacity for a later variant after a broad first query", async () => {
    const target = convexTest(schema, convexModules);
    const snapshotId = await target.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        ...Array.from(
          {
            length: 16,
          },
          (_, index) =>
            makeQuranSearch("en", index + 1, `common result ${index + 1}`)
        ),
        makeQuranSearch("en", 17, "rare alternate result"),
      ])
    );
    const result = await target.query((ctx) =>
      Effect.runPromise(
        readTextCandidates(
          snapshotId,
          "en",
          ["common", "rare"],
          new Set(),
          0,
          2
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      )
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows.some(({ surahNumber }) => surahNumber === 17)).toBe(
      true
    );
  });
  it("refills the complete window when only one alternate variant matches", async () => {
    const target = convexTest(schema, convexModules);
    const snapshotId = await target.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        Array.from(
          {
            length: QURAN_SEARCH_RESULT_LIMIT,
          },
          (_, index) =>
            makeQuranSearch("en", index + 1, `needle result ${index + 1}`)
        )
      )
    );
    const result = await target.query((ctx) =>
      Effect.runPromise(
        readTextCandidates(
          snapshotId,
          "en",
          ["missing", "needle", "absent", "unavailable"],
          new Set(),
          0,
          QURAN_SEARCH_RESULT_LIMIT
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      )
    );
    expect(result.rows).toHaveLength(QURAN_SEARCH_RESULT_LIMIT);
  });
  it("refills the complete window across overlapping alternate variants", async () => {
    const target = convexTest(schema, convexModules);
    const snapshotId = await target.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        Array.from(
          {
            length: QURAN_SEARCH_RESULT_LIMIT,
          },
          (_, index) =>
            makeQuranSearch(
              "en",
              index + 1,
              `common result lesson ${index + 1}`
            )
        )
      )
    );
    const result = await target.query((ctx) =>
      Effect.runPromise(
        readTextCandidates(
          snapshotId,
          "en",
          ["common", "result", "lesson", "common result"],
          new Set(),
          0,
          QURAN_SEARCH_RESULT_LIMIT
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      )
    );
    expect(result.rows).toHaveLength(QURAN_SEARCH_RESULT_LIMIT);
  });
  it("uses remaining read capacity after partially overlapping prefixes", async () => {
    const target = convexTest(schema, convexModules);
    const snapshotId = await target.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        Array.from(
          {
            length: QURAN_SEARCH_RESULT_LIMIT,
          },
          (_, index) => {
            const terms = ["primary"];
            if (index === 0 || index === 1 || index === 3) {
              terms.push("secondary");
            }
            if (index === 0 || index === 1) {
              terms.push("tertiary", "quaternary");
            }
            return makeQuranSearch("en", index + 1, terms.join(" "));
          }
        )
      )
    );
    const result = await target.query((ctx) =>
      Effect.runPromise(
        readTextCandidates(
          snapshotId,
          "en",
          ["primary", "secondary", "tertiary", "quaternary"],
          new Set(),
          0,
          QURAN_SEARCH_RESULT_LIMIT
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      )
    );
    expect(result.rows).toHaveLength(QURAN_SEARCH_RESULT_LIMIT);
  });
});
