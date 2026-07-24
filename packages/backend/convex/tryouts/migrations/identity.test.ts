import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { auditTryoutIdentity } from "@repo/backend/convex/tryouts/migrations/audit";
import { migrateTryoutIdentity } from "@repo/backend/convex/tryouts/migrations/identity";
import type {
  TryoutIdentityPhase,
  TryoutIdentityReceipt,
} from "@repo/backend/convex/tryouts/migrations/spec";
import {
  activateTryoutIdentitySnapshot,
  TRYOUT_IDENTITY_HASH,
} from "@repo/backend/test/tryout-identity";
import { seedLegacyTryoutIdentity } from "@repo/backend/test/tryout-migration";
import { describe, expect, it } from "vitest";

const LIVE_ROW_COUNT = 17;
const counts = {
  attempts: LIVE_ROW_COUNT,
  placements: LIVE_ROW_COUNT,
  progress: LIVE_ROW_COUNT,
  responses: 0,
  scores: 0,
  sections: 0,
};

type IdentityTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Seeds multiple coherent legacy graphs against one active snapshot. */
async function seedLegacyGraphs(t: IdentityTest, count: number) {
  return await t.mutation(async (ctx) => {
    const snapshotId = await activateTryoutIdentitySnapshot(ctx);
    for (let index = 0; index < count; index += 1) {
      await seedLegacyTryoutIdentity(ctx, { suffix: `identity-${index}` });
    }
    return snapshotId;
  });
}

/** Runs every fixed cursor page from the beginning for one migration phase. */
async function migratePages(
  t: IdentityTest,
  input: {
    readonly apply: boolean;
    readonly expectedRows: number;
    readonly phase: TryoutIdentityPhase;
    readonly snapshotId: string;
  }
) {
  const receipts: TryoutIdentityReceipt[] = [];
  let cursor: string | null = null;
  do {
    const receipt = await t.mutation((ctx) =>
      runConvexProgram(
        migrateTryoutIdentity(ctx, {
          ...input,
          paginationOpts: { cursor, numItems: 16 },
        })
      )
    );
    receipts.push(receipt);
    cursor = receipt.continueCursor;
  } while (!receipts.at(-1)?.isDone);
  return receipts;
}

/** Sums one receipt field while retaining page-level assertions. */
function receiptTotal(
  receipts: readonly TryoutIdentityReceipt[],
  field: "candidates" | "processed" | "updated"
) {
  return receipts.reduce((sum, receipt) => sum + receipt[field], 0);
}

describe("tryouts/migrations/identity", () => {
  it("previews, applies, resets, and idempotently verifies 17-row phases", async () => {
    const t = createConvexTestWithBetterAuth();
    const snapshotId = await seedLegacyGraphs(t, LIVE_ROW_COUNT);
    await expect(
      t.query((ctx) => runConvexProgram(auditTryoutIdentity(ctx, counts)))
    ).resolves.toMatchObject({
      missing: {
        attempts: LIVE_ROW_COUNT,
        placements: LIVE_ROW_COUNT,
        progress: LIVE_ROW_COUNT,
      },
    });
    for (const phase of ["attempts", "progress", "placements"] as const) {
      const input = {
        apply: false,
        expectedRows: LIVE_ROW_COUNT,
        phase,
        snapshotId,
      };
      const preview = await migratePages(t, input);
      expect(preview.map(({ processed }) => processed)).toEqual([16, 1]);
      expect(receiptTotal(preview, "candidates")).toBe(LIVE_ROW_COUNT);
      expect(receiptTotal(preview, "updated")).toBe(0);

      const applied = await migratePages(t, { ...input, apply: true });
      expect(applied.map(({ processed }) => processed)).toEqual([16, 1]);
      expect(receiptTotal(applied, "updated")).toBe(LIVE_ROW_COUNT);

      const repeated = await migratePages(t, { ...input, apply: true });
      expect(receiptTotal(repeated, "processed")).toBe(LIVE_ROW_COUNT);
      expect(receiptTotal(repeated, "candidates")).toBe(0);
      expect(receiptTotal(repeated, "updated")).toBe(0);
    }
    await expect(
      t.query((ctx) => runConvexProgram(auditTryoutIdentity(ctx, counts)))
    ).resolves.toMatchObject({
      missing: { attempts: 0, placements: 0, progress: 0 },
    });
  });

  it("rejects count drift between migration pages", async () => {
    const t = createConvexTestWithBetterAuth();
    const snapshotId = await seedLegacyGraphs(t, LIVE_ROW_COUNT);
    const first = await t.mutation((ctx) =>
      runConvexProgram(
        migrateTryoutIdentity(ctx, {
          apply: false,
          expectedRows: LIVE_ROW_COUNT,
          paginationOpts: { cursor: null, numItems: 16 },
          phase: "attempts",
          snapshotId,
        })
      )
    );
    expect(first).toMatchObject({ isDone: false, processed: 16 });
    await t.mutation((ctx) =>
      seedLegacyTryoutIdentity(ctx, { suffix: "identity-drift" })
    );
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          migrateTryoutIdentity(ctx, {
            apply: true,
            expectedRows: LIVE_ROW_COUNT,
            paginationOpts: {
              cursor: first.continueCursor,
              numItems: 16,
            },
            phase: "attempts",
            snapshotId,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_IDENTITY_COUNT_MISMATCH" },
    });
  });

  it("rejects progress rows that collapse to one stable user/set identity", async () => {
    const t = createConvexTestWithBetterAuth();
    const snapshotId = await t.mutation(async (ctx) => {
      const id = await activateTryoutIdentitySnapshot(ctx);
      const first = await seedLegacyTryoutIdentity(ctx, {
        suffix: "identity-duplicate",
      });
      await seedLegacyTryoutIdentity(ctx, { userId: first.userId });
      return id;
    });
    await migratePages(t, {
      apply: true,
      expectedRows: 2,
      phase: "attempts",
      snapshotId,
    });
    await expect(
      migratePages(t, {
        apply: true,
        expectedRows: 2,
        phase: "progress",
        snapshotId,
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_IDENTITY_PROGRESS_DUPLICATE" },
    });
  });

  it("rejects invalid expectations and inactive snapshots", async () => {
    const t = createConvexTestWithBetterAuth();
    const input = {
      apply: false,
      expectedRows: -1,
      paginationOpts: { cursor: null, numItems: 16 },
      phase: "attempts" as const,
      snapshotId: TRYOUT_IDENTITY_HASH,
    };
    await expect(
      t.mutation((ctx) => runConvexProgram(migrateTryoutIdentity(ctx, input)))
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_IDENTITY_EXPECTATION_INVALID" },
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          migrateTryoutIdentity(ctx, { ...input, expectedRows: 0 })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_IDENTITY_SNAPSHOT_INACTIVE" },
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          migrateTryoutIdentity(ctx, {
            ...input,
            expectedRows: 0,
            paginationOpts: { cursor: null, numItems: 17 },
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_IDENTITY_PAGE_INVALID" },
    });
  });

  it("rejects child phases before their attempt root is migrated", async () => {
    const t = createConvexTestWithBetterAuth();
    const snapshotId = await t.mutation(async (ctx) => {
      const id = await activateTryoutIdentitySnapshot(ctx);
      await seedLegacyTryoutIdentity(ctx);
      return id;
    });
    for (const phase of ["progress", "placements"] as const) {
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(
            migrateTryoutIdentity(ctx, {
              apply: true,
              expectedRows: 1,
              paginationOpts: { cursor: null, numItems: 16 },
              phase,
              snapshotId,
            })
          )
        )
      ).rejects.toMatchObject({
        data: { code: "TRYOUT_IDENTITY_ATTEMPT_REQUIRED" },
      });
    }
  });
});
