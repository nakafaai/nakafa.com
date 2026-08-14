import { requireReaderCutoverCheckpoint } from "@repo/backend/convex/contentRelease/cutover/state";
import { ensureState } from "@repo/backend/convex/contentRelease/model";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testReaderCutoverReceipt } from "@repo/backend/test/content-cutover";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const resumeReadModels = makeFunctionReference<
  "mutation",
  { generation: number; releaseId: string },
  null
>("contentRelease/models:resume");

describe("contentRelease/cutover/state", () => {
  it("keeps every destructive drain unreachable before reader acceptance", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(() => runConvexProgram(requireReaderCutoverCheckpoint({})))
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining(
          "reader cutover has not been accepted"
        ),
      },
    });
    await expect(
      t.mutation(() =>
        runConvexProgram(
          requireReaderCutoverCheckpoint({
            readerCutoverReceipt: testReaderCutoverReceipt(),
          })
        )
      )
    ).resolves.toEqual(testReaderCutoverReceipt());
  });

  it("rejects a tampered stored reader receipt", async () => {
    const t = convexTest(schema, convexModules);
    const receipt = testReaderCutoverReceipt();

    await expect(
      t.mutation(() =>
        runConvexProgram(
          requireReaderCutoverCheckpoint({
            readerCutoverReceipt: {
              ...receipt,
              history: {
                ...receipt.history,
                frozenPlacements: receipt.history.frozenPlacements + 1,
              },
            },
          })
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining(
          "reader cutover has not been accepted"
        ),
      },
    });
  });

  it("blocks singleton recreation as soon as the cutover is initialized", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      ctx.db.insert("contentCutoverState", {
        auditedActiveReleaseId: "active-release",
        auditedActiveSequence: 1,
        auditedAt: 1,
        auditedLegacyWriteVersion: 0,
        auditedNextSequence: 2,
        currentDeleted: 0,
        currentTableDeleted: 0,
        currentTableIndex: 0,
        currentTablePreserved: 0,
        inventoryVersion: "production-2026-08-13",
        key: "phase1",
        legacyDeleted: 0,
        legacyTableDeleted: 0,
        legacyTableIndex: 16,
        phase: "audited",
        updatedAt: 2,
      })
    );

    await expect(
      t.mutation((ctx) => runConvexProgram(ensureState(ctx)))
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("strict Phase 1 cutover"),
      },
    });
    await expect(
      t.mutation(resumeReadModels, {
        generation: 1,
        releaseId: "scheduled-before-freeze",
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("strict Phase 1 cutover"),
      },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentState").take(1))
    ).resolves.toEqual([]);
  });
});
