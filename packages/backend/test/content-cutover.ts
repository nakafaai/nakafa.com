import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { replaceContentSnapshot } from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CUTOVER_REFERENCE_PROOF_COUNTS } from "@repo/backend/convex/contentRelease/cutover/evidence";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  testPublicationScope,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  insertTryoutAttempt,
  insertTryoutUser,
} from "@repo/backend/test/tryout-runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";

export const CUTOVER_GENESIS = {
  manifestHash: TEST_MANIFEST_HASH,
  releaseId: "release-cutover-genesis",
  sequence: 1,
} satisfies TestIdentity;

/** Inserts one accepted six-scope genesis plus exact current read-model slots. */
export async function insertAcceptedGenesisPublication(ctx: MutationCtx) {
  const snapshots = {
    program: replacementSnapshot("1"),
    quran: replacementSnapshot("2"),
    tryout: replacementSnapshot("3"),
  };
  await insertZeroRelease(ctx, {
    ...CUTOVER_GENESIS,
    ownership: { base: [], result: ContentFamilySchema.literals },
    role: "candidate",
    scope: testPublicationScope({
      content: [],
      families: ContentFamilySchema.literals,
      snapshots,
    }),
    snapshots,
    status: "completed",
  });
  await insertTestState(ctx, {
    active: CUTOVER_GENESIS,
    article: CUTOVER_GENESIS,
    material: CUTOVER_GENESIS,
    nextSequence: 3,
    search: CUTOVER_GENESIS,
  });
}

/** Inserts the exact proved retained inventory used by terminal retirement tests. */
export async function insertProvedCutoverInventory(ctx: MutationCtx) {
  const users = await Promise.all(
    Array.from(
      { length: retainedTryoutHistoryPlan.progressCount },
      (_, index) =>
        insertTryoutUser(ctx, {
          authId: `cutover-retirement-${index}`,
          email: `cutover-retirement-${index}@example.com`,
          name: `Cutover Retirement ${index}`,
        })
    )
  );
  const attemptsByUser = new Map<Id<"users">, Id<"tryoutAttempts">[]>();
  const attemptIds: Id<"tryoutAttempts">[] = [];

  for (
    let index = 0;
    index < retainedTryoutHistoryPlan.attemptCount;
    index += 1
  ) {
    const userId = users[index % users.length];
    if (!userId) {
      throw new Error("Expected cutover retirement user fixture.");
    }
    const ownedAttempts = attemptsByUser.get(userId) ?? [];
    const release =
      index < retainedTryoutHistoryPlan.releases[0].attemptCount
        ? retainedTryoutHistoryPlan.releases[0]
        : retainedTryoutHistoryPlan.releases[1];
    if (!release) {
      throw new Error("Expected cutover retirement release fixture.");
    }
    const attemptId = await insertTryoutAttempt(ctx, {
      sectionSnapshots: [],
      set: makeTryoutSet(),
      snapshotId: retainedTryoutHistoryPlan.snapshotId,
      snapshotReleaseId: release.releaseId,
      userId,
    });
    await ctx.db.patch("tryoutAttempts", attemptId, {
      attemptNumber: ownedAttempts.length + 1,
      locale: "id",
      totalQuestions:
        index <
        retainedTryoutHistoryPlan.frozenPlacementCount %
          retainedTryoutHistoryPlan.attemptCount
          ? Math.ceil(
              retainedTryoutHistoryPlan.frozenPlacementCount /
                retainedTryoutHistoryPlan.attemptCount
            )
          : Math.floor(
              retainedTryoutHistoryPlan.frozenPlacementCount /
                retainedTryoutHistoryPlan.attemptCount
            ),
    });
    ownedAttempts.push(attemptId);
    attemptsByUser.set(userId, ownedAttempts);
    attemptIds.push(attemptId);
  }

  let placementIndex = 0;
  const placementIds: Id<"tryoutAttemptPlacements">[] = [];
  for (const attemptId of attemptIds) {
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) {
      throw new Error("Expected cutover retirement placement owner.");
    }
    for (
      let questionOrder = 1;
      questionOrder <= attempt.totalQuestions;
      questionOrder += 1
    ) {
      placementIndex += 1;
      placementIds.push(
        await ctx.db.insert("tryoutAttemptPlacements", {
          answerArtifactHash: `sha256:${"a".repeat(64)}`,
          answerContentKey: `answer-${placementIndex}`,
          choiceSnapshots: [],
          contentHash: "c".repeat(64),
          placementIdentity: `placement-${placementIndex}`,
          placementRowHash: `sha256:${"d".repeat(64)}`,
          questionArtifactHash: `sha256:${"b".repeat(64)}`,
          questionContentKey: `question-${placementIndex}`,
          questionOrder,
          rendererDomain: "snbt-general",
          sectionIdentity: "section:general-reasoning",
          sectionKey: "general-reasoning",
          sourcePath: `packages/corpus/question-${placementIndex}`,
          sourceRevision: "retained",
          title: `Question ${placementIndex}`,
          tryoutAttemptId: attemptId,
        })
      );
    }
  }

  const progressIds: Id<"tryoutSetProgress">[] = [];
  for (const [userId, ownedAttempts] of attemptsByUser) {
    const latestAttemptId = ownedAttempts.at(-1);
    if (!latestAttemptId) {
      throw new Error("Expected cutover retirement attempt fixture.");
    }
    const attempt = await ctx.db.get(latestAttemptId);
    if (!attempt) {
      throw new Error("Expected latest cutover retirement attempt.");
    }
    progressIds.push(
      await ctx.db.insert("tryoutSetProgress", {
        appLocale: attempt.appLocale,
        attemptNumber: attempt.attemptNumber,
        countryKey: attempt.countryKey,
        examKey: attempt.examKey,
        latestAttemptId,
        locale: "id",
        publishedScore: null,
        setIdentity: attempt.setIdentity,
        setKey: attempt.setKey,
        status: attempt.status,
        statusRank: 1,
        trackKey: attempt.trackKey,
        updatedAt: 1,
        userId,
      })
    );
  }

  await ctx.db.insert("contentCutoverActivity", {
    key: "legacy",
    updatedAt: 2,
    version: 0,
  });
  await ctx.db.insert("contentCutoverState", {
    articleReferenceProof: {
      count: CUTOVER_REFERENCE_PROOF_COUNTS.article,
      provedAt: 2,
    },
    audioWorkflowAudit: {
      failed: 26,
      steps: 315,
      succeeded: 37,
      total: 63,
      workflows: Array.from({ length: 63 }, (_, index) => ({
        id: `workflow-${index}`,
        result: index < 37 ? ("success" as const) : ("failed" as const),
        steps: 5,
      })),
    },
    audioWorkflowAuditedAt: 1,
    audioWorkflowCleanedAt: 2,
    auditedActiveReleaseId: "retired-release",
    auditedActiveSequence: 25,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: 26,
    currentDeleted: 22_954,
    currentTableDeleted: 0,
    currentTableIndex: 22,
    currentTablePreserved: 45,
    inventoryVersion: "production-2026-08-13",
    key: "phase1",
    legacyDeleted: 12_854,
    legacyTableDeleted: 0,
    legacyTableIndex: 16,
    materialReferenceProof: {
      count: CUTOVER_REFERENCE_PROOF_COUNTS.material,
      provedAt: 2,
    },
    materialTopicReferenceProof: {
      count: CUTOVER_REFERENCE_PROOF_COUNTS.materialTopic,
      provedAt: 2,
    },
    phase: "proved",
    provedAt: 2,
    quranReferenceProof: {
      count: CUTOVER_REFERENCE_PROOF_COUNTS.quran,
      provedAt: 2,
    },
    readerCutoverReceipt: {
      acceptedAt: 2,
      history: {
        attempts: retainedTryoutHistoryPlan.attemptCount,
        declaredFrozenPlacements:
          retainedTryoutHistoryPlan.frozenPlacementCount,
        markers: retainedTryoutHistoryPlan.attemptCount,
        releases: retainedTryoutHistoryPlan.releases.map((release) => ({
          attempts: release.attemptCount,
          releaseId: release.releaseId,
        })),
        snapshotId: retainedTryoutHistoryPlan.snapshotId,
      },
      referenceProofs: CUTOVER_REFERENCE_PROOF_COUNTS,
    },
    retiredProgramZeroReceipt: {
      learningPlanItems: 0,
      learningPlans: 0,
      learningProfiles: 0,
      learningProgramCoverage: 0,
      learningProgramSources: 0,
      learningPrograms: 0,
      version: "retired-learning-program-zero-v1",
    },
    tryoutReferenceProof: {
      count: CUTOVER_REFERENCE_PROOF_COUNTS.tryout,
      provedAt: 2,
    },
    updatedAt: 2,
  });
  return { attemptIds, placementIds, progressIds };
}

function replacementSnapshot(digit: string) {
  const snapshotId = Sha256HashSchema.make(`sha256:${digit.repeat(64)}`);
  return replaceContentSnapshot({
    baseSnapshotId: null,
    resultSnapshotId: snapshotId,
    rowCount: 1,
    rowDigest: TEST_DIGEST,
  });
}
