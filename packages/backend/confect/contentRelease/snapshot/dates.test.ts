import { describe, expect, it } from "@effect/vitest";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { activateAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import { convexTest } from "convex-test";

const readDates = api.contentRelease.runtime.active.dates;

/** 31 October 2026, 23:30 UTC, already 1 November in Jakarta and Berlin. */
const LATE_ON_THE_LAST_DAY = Date.UTC(2026, 9, 31, 23, 30);

describe("contentRelease/snapshot/dates", () => {
  it("dates nothing before any release is active", async () => {
    const t = convexTest(schema, convexModules);
    await expect(t.query(readDates, {})).resolves.toEqual({
      assessment: null,
      program: null,
      quran: null,
    });
  });

  it("dates a family by its snapshot's first verification, on the UTC day", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateQuranSnapshot(ctx, [makeQuranSearch("en", 1, "Technical")]);
      const snapshot = await ctx.db.query("contentSnapshots").unique();
      if (!snapshot) {
        throw new Error("Expected the active Quran snapshot.");
      }
      await ctx.db.patch("contentSnapshots", snapshot._id, {
        verifiedAt: LATE_ON_THE_LAST_DAY,
      });
    });
    await expect(t.query(readDates, {})).resolves.toEqual({
      assessment: null,
      program: null,
      quran: "2026-10-31",
    });
  });

  it("reads each family from its own snapshot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(activateAssessmentTestSnapshot);
    await expect(t.query(readDates, {})).resolves.toMatchObject({
      assessment: "1970-01-01",
      quran: null,
    });
  });

  it("refuses an active snapshot that was lost", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateQuranSnapshot(ctx, [makeQuranSearch("en", 1, "Technical")]);
      const snapshot = await ctx.db.query("contentSnapshots").unique();
      if (!snapshot) {
        throw new Error("Expected the active Quran snapshot.");
      }
      await ctx.db.delete("contentSnapshots", snapshot._id);
    });
    await expect(t.query(readDates, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("refuses an active snapshot that was never verified", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateQuranSnapshot(ctx, [makeQuranSearch("en", 1, "Technical")]);
      const snapshot = await ctx.db.query("contentSnapshots").unique();
      if (!snapshot) {
        throw new Error("Expected the active Quran snapshot.");
      }
      await ctx.db.patch("contentSnapshots", snapshot._id, {
        verifiedAt: undefined,
      });
    });
    await expect(t.query(readDates, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
