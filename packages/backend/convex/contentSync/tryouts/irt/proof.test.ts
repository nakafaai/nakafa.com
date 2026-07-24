import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { activateIrtSyncSnapshot } from "@repo/backend/test/tryout-sync";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

const sourcePath =
  "question-bank/tryout/indonesia/snbt/2027/set-1/penalaran-matematika";
const publicPath = "try-out/indonesia/snbt/2027/set-1/penalaran-matematika";

/** Builds one complete technical IRT sync source. */
function buildPayload() {
  return {
    countries: [],
    exams: [],
    questionSets: [
      {
        contentHash: "question-set-hash",
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id" as const,
        questionCount: 1,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourcePath,
        sourceRevision: "2026",
        title: "Penalaran Matematika",
      },
    ],
    questions: [
      {
        answerBody: "Technical answer",
        authors: [],
        choices: [
          {
            isCorrect: true,
            label: "A",
            optionKey: "option-1",
            order: 1,
          },
          {
            isCorrect: false,
            label: "B",
            optionKey: "option-2",
            order: 2,
          },
        ],
        contentHash: "question-hash",
        date: 0,
        locale: "id" as const,
        number: 1,
        questionBody: "Technical question",
        questionSetSourcePath: sourcePath,
        sourceKey: `${sourcePath}:question-1`,
        sourcePath: `${sourcePath}/question-1`,
        sourceRevision: "2026",
        title: "Technical question",
      },
    ],
    routes: [],
    sections: [
      {
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id" as const,
        order: 1,
        publicPath,
        questionCount: 1,
        questionSourcePath: sourcePath,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        title: "Penalaran Matematika",
        trackKey: "2027",
        visibility: "visible" as const,
      },
    ],
    sets: [
      {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        isReady: true,
        locale: "id" as const,
        order: 1,
        publicPath: "try-out/indonesia/snbt/2027/set-1",
        readyQuestionCount: 1,
        readyVisibleSectionCount: 1,
        scoringStrategy: "irt" as const,
        sectionCount: 1,
        setKey: "set-1",
        sourceRevision: "2026",
        title: "Set 1",
        totalQuestionCount: 1,
        trackKey: "2027",
        visibleSectionCount: 1,
      },
    ],
    tracks: [],
  };
}

/** Removes sections so catalog and questions synchronize before IRT proof. */
function basePayload(payload: ReturnType<typeof buildPayload>) {
  return { ...payload, sections: [] };
}

/** Isolates the production section batch that provisions IRT rows. */
function sectionPayload(payload: ReturnType<typeof buildPayload>) {
  return {
    countries: [],
    exams: [],
    questionSets: [],
    questions: [],
    routes: [],
    sections: payload.sections,
    sets: [],
    tracks: [],
  };
}

/** Reads all durable IRT rows created for the technical set. */
async function readIrtState(t: TestConvex<typeof schema>) {
  return await t.query(async (ctx) => ({
    items: await ctx.db.query("irtScaleItems").take(2),
    runs: await ctx.db.query("irtCalibrationRuns").take(2),
    scales: await ctx.db.query("irtScaleVersions").take(2),
    sections: await ctx.db.query("tryoutSections").take(2),
  }));
}

describe("contentSync/tryouts/irt/proof", () => {
  it("writes every scale identity from one active signed snapshot", async () => {
    const t = convexTest(schema, convexModules);
    const payload = buildPayload();
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      basePayload(payload)
    );
    const snapshotId = await t.mutation((ctx) =>
      activateIrtSyncSnapshot(ctx, payload)
    );

    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      sectionPayload(payload)
    );
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      sectionPayload(payload)
    );
    const state = await readIrtState(t);

    expect(state.scales).toEqual([
      expect.objectContaining({
        setIdentity: expect.any(String),
        tryoutSnapshotId: snapshotId,
      }),
    ]);
    expect(state.runs).toEqual([
      expect.objectContaining({
        scaleVersionId: state.scales[0]?._id,
        sectionIdentity: expect.any(String),
      }),
    ]);
    expect(state.items).toEqual([
      expect.objectContaining({
        placementIdentity: expect.any(String),
        placementRowHash: expect.any(String),
      }),
    ]);
  });

  it("rejects a missing active proof before writing a section or scale", async () => {
    const t = convexTest(schema, convexModules);
    const payload = buildPayload();
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      basePayload(payload)
    );

    await expect(
      t.mutation(
        internal.contentSync.mutations.tryouts.bulkSyncTryouts,
        sectionPayload(payload)
      )
    ).rejects.toThrow("TRYOUT_IRT_PROOF_REQUIRED");
    const state = await readIrtState(t);

    expect(state.sections).toEqual([]);
    expect(state.scales).toEqual([]);
  });

  it("rejects mismatched signed section evidence before any write", async () => {
    const t = convexTest(schema, convexModules);
    const payload = buildPayload();
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      basePayload(payload)
    );
    await t.mutation((ctx) => activateIrtSyncSnapshot(ctx, payload));
    const mismatched = sectionPayload(payload);
    mismatched.sections[0] = {
      ...mismatched.sections[0],
      timeLimitSeconds: 1801,
    };

    await expect(
      t.mutation(
        internal.contentSync.mutations.tryouts.bulkSyncTryouts,
        mismatched
      )
    ).rejects.toThrow("TRYOUT_SNAPSHOT_SECTION_MISMATCH");
    const state = await readIrtState(t);

    expect(state.sections).toEqual([]);
    expect(state.scales).toEqual([]);
  });
});
