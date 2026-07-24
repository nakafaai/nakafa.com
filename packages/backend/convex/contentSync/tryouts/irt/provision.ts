import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { IrtSectionSnapshot } from "@repo/backend/convex/contentSync/tryouts/irt/snapshot";
import type { IrtSyncSetProof } from "@repo/backend/convex/contentSync/tryouts/irt/spec";
import { ConvexError } from "convex/values";

const IRT_MODEL = "2pl";
const PROVISIONAL_DIFFICULTY = 0;
const PROVISIONAL_DISCRIMINATION = 1;

type TryoutSet = Doc<"tryoutSets">;
type TryoutSection = Doc<"tryoutSections">;
type Question = Doc<"questions">;

/** Inserts one provisional scale version and its signed section rows. */
export async function provisionIrtScale(
  ctx: MutationCtx,
  args: {
    proof: IrtSyncSetProof;
    set: TryoutSet;
    snapshot: IrtSectionSnapshot[];
    syncedAt: number;
  }
) {
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: IRT_MODEL,
    publishedAt: args.syncedAt,
    questionCount: args.set.totalQuestionCount,
    setIdentity: args.proof.setIdentity,
    status: "provisional",
    tryoutSnapshotId: args.proof.snapshotId,
    tryoutSetId: args.set._id,
  });

  for (const item of args.snapshot) {
    const sectionProof = args.proof.sections.find(
      ({ sectionKey }) => sectionKey === item.section.sectionKey
    );
    if (!sectionProof) {
      throw new ConvexError({
        code: "TRYOUT_IRT_PROOF_MISSING",
        message: `Missing signed IRT proof for section ${item.section.sectionKey}.`,
      });
    }
    await provisionSectionItems(ctx, {
      proof: sectionProof,
      scaleVersionId,
      section: item.section,
      questions: item.questions,
      syncedAt: args.syncedAt,
    });
  }
}

/** Inserts provisional IRT item parameters for one section snapshot. */
async function provisionSectionItems(
  ctx: MutationCtx,
  args: {
    proof: IrtSyncSetProof["sections"][number];
    scaleVersionId: Id<"irtScaleVersions">;
    section: TryoutSection;
    questions: Question[];
    syncedAt: number;
  }
) {
  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 0,
    completedAt: args.syncedAt,
    iterationCount: 0,
    maxParameterDelta: 0,
    model: IRT_MODEL,
    questionCount: args.questions.length,
    responseCount: 0,
    scaleVersionId: args.scaleVersionId,
    sectionIdentity: args.proof.sectionIdentity,
    startedAt: args.syncedAt,
    status: "completed",
    tryoutSectionId: args.section._id,
    updatedAt: args.syncedAt,
  });

  for (const question of args.questions) {
    const placement = args.proof.placements.find(
      ({ questionSourceKey }) => questionSourceKey === question.sourceKey
    );
    if (!placement) {
      throw new ConvexError({
        code: "TRYOUT_IRT_PROOF_MISSING",
        message: `Missing signed IRT proof for question ${question.sourceKey}.`,
      });
    }
    await provisionQuestionItem(ctx, {
      calibrationRunId,
      placement,
      question,
      scaleVersionId: args.scaleVersionId,
    });
  }
}

/** Inserts one provisional IRT item from one synchronized question row. */
async function provisionQuestionItem(
  ctx: MutationCtx,
  args: {
    calibrationRunId: Id<"irtCalibrationRuns">;
    placement: IrtSyncSetProof["sections"][number]["placements"][number];
    question: Question;
    scaleVersionId: Id<"irtScaleVersions">;
  }
) {
  await ctx.db.insert("irtScaleItems", {
    calibrationRunId: args.calibrationRunId,
    calibrationStatus: "provisional",
    contentHash: args.question.contentHash,
    correctRate: 0,
    difficulty: PROVISIONAL_DIFFICULTY,
    discrimination: PROVISIONAL_DISCRIMINATION,
    placementIdentity: args.placement.placementIdentity,
    placementRowHash: args.placement.placementRowHash,
    questionId: args.question._id,
    questionSourceKey: args.question.sourceKey,
    responseCount: 0,
    scaleVersionId: args.scaleVersionId,
    sourceRevision: args.question.sourceRevision,
  });
}
