import {
  type StoredProtectedRuntimeRequest,
  StoredProtectedRuntimeRequestSchema,
} from "@nakafa/aksara-history/history/decode";
import type { RetainedRuntimeBatchRow } from "@repo/backend/convex/contentRelease/runtime/history/internal";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRetainedRuntime,
  RETAINED_RUNTIME_QUESTION,
} from "@repo/backend/test/retained-runtime";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const readRetained = makeFunctionReference<
  "query",
  StoredProtectedRuntimeRequest,
  RetainedRuntimeBatchRow
>("contentRelease/runtime/history/internal:read");

describe("contentRelease/runtime/history/internal", () => {
  it("returns exact old bytes for one marked attempt-owned placement", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertRetainedRuntime);

    const result = await t.query(readRetained, fixture.request);

    expect(result).toMatchObject({
      appLocale: fixture.request.appLocale,
      attemptId: fixture.request.attemptId,
      items: [
        {
          delivery: "authenticated",
          sourcePath:
            "packages/corpus/question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question.en.mdx",
        },
      ],
      snapshotId: fixture.request.snapshotId,
      snapshotReleaseId: fixture.request.snapshotReleaseId,
    });
    expect(JSON.parse(result?.items[0]?.artifactJson ?? "{}")).toMatchObject({
      artifactHash: RETAINED_RUNTIME_QUESTION.artifactHash,
    });
  });

  it("never probes historical bytes without the exact marker", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertRetainedRuntime);
    await t.mutation(async (ctx) => {
      const marker = await ctx.db.query("tryoutAttemptHistory").unique();
      const row = await ctx.db.query("tryoutHistoryRows").unique();
      if (!(marker && row)) {
        throw new Error("Expected retained runtime marker and row.");
      }
      await ctx.db.delete("tryoutAttemptHistory", marker._id);
      await ctx.db.patch("tryoutHistoryRows", row._id, { rowJson: "{}" });
    });

    await expect(t.query(readRetained, fixture.request)).resolves.toBeNull();
  });

  it("rejects an attempt whose migrated and route locales diverge", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertRetainedRuntime);
    await t.mutation(async (ctx) => {
      const attemptId = ctx.db.normalizeId(
        "tryoutAttempts",
        fixture.request.attemptId
      );
      if (!attemptId) {
        throw new Error("Expected one retained attempt ID.");
      }
      await ctx.db.patch("tryoutAttempts", attemptId, { locale: "id" });
    });

    await expect(t.query(readRetained, fixture.request)).resolves.toBeNull();
  });

  it("keeps assessed-language bytes separate from the attempt app locale", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation((ctx) =>
      insertRetainedRuntime(ctx, { appLocale: "id" })
    );

    const result = await t.query(readRetained, fixture.request);
    const artifact = JSON.parse(result?.items[0]?.artifactJson ?? "{}");

    expect(result?.appLocale).toBe("id");
    expect(artifact.payload?.locale).toBe("en");
  });

  it("fails closed when the frozen or authenticated placement drifts", async () => {
    const frozenDamage = convexTest(schema, convexModules);
    const frozenFixture = await frozenDamage.mutation(insertRetainedRuntime);
    await frozenDamage.mutation(async (ctx) => {
      const placement = await ctx.db.query("tryoutAttemptPlacements").unique();
      if (!placement) {
        throw new Error("Expected frozen retained placement.");
      }
      await ctx.db.patch("tryoutAttemptPlacements", placement._id, {
        sourceRevision: "changed",
      });
    });
    await expect(
      frozenDamage.query(readRetained, frozenFixture.request)
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const historyDamage = convexTest(schema, convexModules);
    const historyFixture = await historyDamage.mutation(insertRetainedRuntime);
    await historyDamage.mutation(async (ctx) => {
      const row = await ctx.db.query("tryoutHistoryRows").unique();
      if (!row) {
        throw new Error("Expected authenticated retained placement.");
      }
      await ctx.db.patch("tryoutHistoryRows", row._id, { rowJson: "{}" });
    });
    await expect(
      historyDamage.query(readRetained, historyFixture.request)
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_INTEGRITY" },
    });
  });

  it("returns absence for a selector outside the frozen attempt", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertRetainedRuntime);
    const request = Schema.decodeUnknownSync(
      StoredProtectedRuntimeRequestSchema
    )({
      ...fixture.request,
      selectors: [
        {
          ...fixture.request.selectors[0],
          artifactHash: `sha256:${"f".repeat(64)}`,
        },
      ],
    });

    await expect(t.query(readRetained, request)).resolves.toBeNull();
  });
});
