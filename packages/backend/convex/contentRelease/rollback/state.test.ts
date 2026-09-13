import { describe, expect, it } from "@effect/vitest";
import { RollbackSnapshotEntrySchema } from "@nakafa/aksara-contracts/release/rollback/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { rollbackRecord } from "@repo/backend/convex/contentRelease/rollback/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_DIGEST,
  testDeleteJson,
} from "@repo/backend/test/content/release";
import { insertRollbackItem } from "@repo/backend/test/content/rollback";
import { convexTest } from "convex-test";
import { Schema } from "effect";

/** Selects the exact transition that each corruption test deliberately damages. */
async function item(ctx: QueryCtx) {
  const row = await ctx.db.query("contentItems").unique();
  if (!row) {
    throw new Error("Expected one rollback item.");
  }
  return row;
}

/** Selects the prior or current immutable version without changing its identity. */
async function head(ctx: QueryCtx, sequence: number) {
  const row = await ctx.db
    .query("contentHeads")
    .withIndex("by_contentKey_and_artifactLocale_and_sequence", (q) =>
      q
        .eq("contentKey", "test:head-0")
        .eq("artifactLocale", "en")
        .eq("sequence", sequence)
    )
    .unique();
  if (!row) {
    throw new Error("Expected the immutable rollback version.");
  }
  return row;
}

describe("immutable rollback transition reconstruction", () => {
  it.each([
    "projection",
    "current version",
    "prior sequence",
    "prior version",
    "prior projection",
    "version digest",
    "projection identity",
    "snapshot digest",
  ] as const)("fails closed after losing %s", async (corruption) => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRollbackItem(ctx, 0, true);
      const row = await item(ctx);
      switch (corruption) {
        case "projection":
          await ctx.db.patch("contentItems", row._id, {
            projectionJson: undefined,
          });
          break;
        case "current version":
          await ctx.db.delete("contentHeads", (await head(ctx, 1))._id);
          break;
        case "prior sequence":
          await ctx.db.patch("contentItems", row._id, {
            priorSequence: undefined,
          });
          break;
        case "prior version":
          await ctx.db.delete("contentHeads", (await head(ctx, 0))._id);
          break;
        case "prior projection":
          await ctx.db.patch("contentHeads", (await head(ctx, 0))._id, {
            projectionJson: undefined,
          });
          break;
        case "version digest":
          await ctx.db.patch("contentHeads", (await head(ctx, 1))._id, {
            projectionHash: TEST_DIGEST,
          });
          break;
        case "projection identity":
          await ctx.db.patch("contentItems", row._id, {
            projectionJson: testProjectionJson({ contentKey: "test:other" }),
          });
          break;
        case "snapshot digest": {
          const snapshot = Schema.decodeSync(
            Schema.fromJsonString(RollbackSnapshotEntrySchema)
          )(row.rollbackJson);
          if (snapshot.snapshot.state === "absent") {
            throw new Error("Expected a prior content head.");
          }
          await ctx.db.patch("contentItems", row._id, {
            rollbackJson: JSON.stringify({
              ...snapshot,
              snapshot: {
                ...snapshot.snapshot,
                head: {
                  ...snapshot.snapshot.head,
                  projectionHash: TEST_DIGEST,
                },
              },
            }),
          });
          break;
        }
        default:
          throw new Error(`Unexpected corruption fixture: ${corruption}`);
      }
    });
    await expect(
      t.query(async (ctx) =>
        runConvexProgram(rollbackRecord(ctx, await item(ctx)))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("reconstructs a deleted body from its exact immutable predecessor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRollbackItem(ctx, 0, true);
      const row = await item(ctx);
      await ctx.db.patch("contentItems", row._id, {
        itemJson: testDeleteJson({ contentKey: row.contentKey }),
      });
    });
    await expect(
      t.query(async (ctx) =>
        runConvexProgram(rollbackRecord(ctx, await item(ctx)))
      )
    ).resolves.toMatchObject({
      current: { change: { operation: "delete" } },
      prior: { change: { operation: "upsert" } },
    });
  });
});
