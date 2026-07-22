import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";

export const TRYOUT_START_NOW = Date.UTC(2026, 6, 8, 12, 0, 0);
export const TRYOUT_START_COUNTRY = "indonesia";
export const TRYOUT_START_EXAM = "tka";
export const TRYOUT_START_TRACK = "matematika";
export const TRYOUT_START_SET = "set-1";
export const TRYOUT_START_SECTION = "matematika";

const sourcePath = `question-bank/tryout/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}/${TRYOUT_START_SECTION}`;
const setRoute = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;

/** Seeds the smallest coherent catalog used by attempt start tests. */
export async function seedTryoutStartSet(
  ctx: MutationCtx,
  args: {
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
    optionKey: "a",
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

  return { tryoutSectionId, tryoutSetId };
}
