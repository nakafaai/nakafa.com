import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  TryoutCatalogRowSchema,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import { Schema } from "effect";

export const TRYOUT_START_NOW = Date.UTC(2026, 6, 8, 12, 0, 0);
export const TRYOUT_START_COUNTRY = "indonesia";
export const TRYOUT_START_EXAM = "tka";
export const TRYOUT_START_TRACK = "matematika";
export const TRYOUT_START_SET = "set-1";
export const TRYOUT_START_SECTION = "matematika";

const sourcePath = `question-bank/tryout/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}/${TRYOUT_START_SECTION}`;
const setRoute = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const artifactHash = Sha256HashSchema.make(`sha256:${"7".repeat(64)}`);

/** Seeds the smallest coherent catalog used by attempt start tests. */
export async function seedTryoutStartSet(
  ctx: MutationCtx,
  args: {
    activateSnapshot?: boolean;
    includeEntitlement?: boolean;
    isReady?: boolean;
    trackIsReady?: boolean;
    userId: Id<"users">;
    visibility: "internal-entry" | "visible";
  }
) {
  await ctx.db.insert("tryoutCountries", {
    countryKey: TRYOUT_START_COUNTRY,
    isActive: true,
    locale: "id",
    order: 1,
    publicPath: `try-out/${TRYOUT_START_COUNTRY}`,
    sourceRevision: "2026",
    syncedAt: TRYOUT_START_NOW,
    title: "Indonesia",
  });
  await ctx.db.insert("tryoutExams", {
    countryKey: TRYOUT_START_COUNTRY,
    examKey: TRYOUT_START_EXAM,
    isActive: true,
    locale: "id",
    order: 1,
    publicPath: `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}`,
    scoringStrategy: "raw",
    sourceRevision: "2026",
    syncedAt: TRYOUT_START_NOW,
    title: "TKA",
  });
  await ctx.db.insert("tryoutTracks", {
    authoredSetCount: 1,
    countryKey: TRYOUT_START_COUNTRY,
    examKey: TRYOUT_START_EXAM,
    isActive: true,
    isReady: args.trackIsReady ?? true,
    locale: "id",
    order: 1,
    publicPath: `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}`,
    readyQuestionCount: 1,
    readySetCount: args.trackIsReady === false ? 0 : 1,
    readyVisibleSectionCount:
      args.trackIsReady === false || args.visibility !== "visible" ? 0 : 1,
    sourceRevision: "2026",
    syncedAt: TRYOUT_START_NOW,
    title: "Matematika",
    trackKey: TRYOUT_START_TRACK,
    trackKind: "subject",
  });

  const questionSetId = await ctx.db.insert("questionSets", {
    contentHash: "question-set-hash",
    countryKey: TRYOUT_START_COUNTRY,
    examKey: TRYOUT_START_EXAM,
    locale: "id",
    questionCount: 1,
    sectionKey: TRYOUT_START_SECTION,
    setKey: TRYOUT_START_SET,
    sourcePath,
    sourceRevision: "2026",
    syncedAt: TRYOUT_START_NOW,
    title: "Matematika",
  });
  const questionId = await ctx.db.insert("questions", {
    answerBody: "Answer",
    contentHash: "question-hash",
    date: 0,
    locale: "id",
    number: 1,
    questionBody: "Question",
    questionSetId,
    sourceKey: `${sourcePath}:question-1`,
    sourcePath: `${sourcePath}/question-1`,
    sourceRevision: "2026",
    syncedAt: TRYOUT_START_NOW,
    title: "Question",
  });

  await ctx.db.insert("questionChoices", {
    isCorrect: true,
    label: "A",
    locale: "id",
    optionKey: "option-1",
    order: 1,
    questionId,
  });

  const tryoutSetId = await ctx.db.insert("tryoutSets", {
    countryKey: TRYOUT_START_COUNTRY,
    examKey: TRYOUT_START_EXAM,
    internalEntrySectionKey:
      args.visibility === "internal-entry" ? TRYOUT_START_SECTION : undefined,
    isActive: true,
    isReady: args.isReady ?? true,
    locale: "id",
    order: 1,
    publicPath: setRoute,
    readyQuestionCount: 1,
    readyVisibleSectionCount: args.visibility === "visible" ? 1 : 0,
    scoringStrategy: "raw",
    sectionCount: 1,
    setKey: TRYOUT_START_SET,
    sourceRevision: "2026",
    syncedAt: TRYOUT_START_NOW,
    title: "Set 1",
    totalQuestionCount: 1,
    trackKey: TRYOUT_START_TRACK,
    visibleSectionCount: args.visibility === "visible" ? 1 : 0,
  });
  const tryoutSectionId = await ctx.db.insert("tryoutSections", {
    countryKey: TRYOUT_START_COUNTRY,
    examKey: TRYOUT_START_EXAM,
    locale: "id",
    order: 1,
    publicPath:
      args.visibility === "visible"
        ? `${setRoute}/${TRYOUT_START_SECTION}`
        : undefined,
    questionCount: 1,
    questionSetId,
    questionSourcePath: sourcePath,
    sectionKey: TRYOUT_START_SECTION,
    setKey: TRYOUT_START_SET,
    sourceRevision: "2026",
    syncedAt: TRYOUT_START_NOW,
    timeLimitSeconds: 1800,
    title: "Matematika",
    trackKey: TRYOUT_START_TRACK,
    tryoutSetId,
    visibility: args.visibility,
  });

  if (args.includeEntitlement) {
    await ctx.db.insert("tryoutEntitlements", {
      countryKey: TRYOUT_START_COUNTRY,
      endsAt: TRYOUT_START_NOW + 86_400_000,
      examKey: TRYOUT_START_EXAM,
      setKey: TRYOUT_START_SET,
      sourceKind: tryoutEntitlementSourceKindCompetition,
      startsAt: TRYOUT_START_NOW,
      trackKey: TRYOUT_START_TRACK,
      userId: args.userId,
    });
  }

  const snapshotId =
    args.activateSnapshot === false
      ? null
      : await activateTryoutSnapshot(ctx, {
          catalog: buildCatalog(args.visibility),
          placements: [buildPlacement()],
        });

  return { snapshotId, tryoutSectionId, tryoutSetId };
}

/** Builds the exact set and section rows consumed by the start fixture. */
function buildCatalog(visibility: "internal-entry" | "visible") {
  const graph = {
    alignmentId: "alignment:tryout:start",
    assetId: "asset:id:tryout:start",
    conceptId: "concept:tryout:start",
    learningObjectId: "lo:tryout-start",
    lensId: "lens:tryout:start",
  };
  return [
    Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      graph,
      internalEntrySectionKey:
        visibility === "internal-entry" ? TRYOUT_START_SECTION : undefined,
      kind: "set",
      locale: "id",
      order: 1,
      publicPath: setRoute,
      questionCount: 1,
      scoringStrategy: "raw",
      sectionCount: 1,
      setKey: TRYOUT_START_SET,
      sourceRevision: "2026",
      title: "Set 1",
      trackKey: TRYOUT_START_TRACK,
      visibleSectionCount: visibility === "visible" ? 1 : 0,
    }),
    Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      graph,
      kind: "section",
      locale: "id",
      order: 1,
      publicPath:
        visibility === "visible"
          ? `${setRoute}/${TRYOUT_START_SECTION}`
          : undefined,
      questionCount: 1,
      questionSourcePath: `packages/corpus/${sourcePath}`,
      sectionKey: TRYOUT_START_SECTION,
      setKey: TRYOUT_START_SET,
      sourceRevision: "2026",
      timeLimitSeconds: 1800,
      title: "Matematika",
      trackKey: TRYOUT_START_TRACK,
      visibility,
    }),
  ];
}

/** Builds the signed placement matching the synchronized start question. */
function buildPlacement() {
  return Schema.decodeUnknownSync(TryoutPlacementSchema)({
    answerArtifactHash: artifactHash,
    answerContentKey: `${sourcePath}/question-1/answer`,
    choices: [
      {
        isCorrect: true,
        label: "A",
        optionKey: "option-1",
        order: 1,
      },
    ],
    countryKey: TRYOUT_START_COUNTRY,
    examKey: TRYOUT_START_EXAM,
    locale: "id",
    questionArtifactHash: artifactHash,
    questionContentKey: `${sourcePath}/question-1/question`,
    questionOrder: 1,
    questionSourcePath: `packages/corpus/${sourcePath}/question-1`,
    rendererDomain: "tka-math",
    scope: "server",
    sectionKey: TRYOUT_START_SECTION,
    setKey: TRYOUT_START_SET,
    sourceRevision: "2026",
    title: "Question",
    trackKey: TRYOUT_START_TRACK,
  });
}
