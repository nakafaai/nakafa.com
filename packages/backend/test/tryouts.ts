import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

export const TRYOUT_TEST_NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
export const TRYOUT_COUNTRY_PATH = "try-out/indonesia";
export const TRYOUT_EXAM_PATH = `${TRYOUT_COUNTRY_PATH}/snbt`;
export const TRYOUT_TRACK_PATH = `${TRYOUT_EXAM_PATH}/2027`;
export const TRYOUT_SET_PATH = `${TRYOUT_TRACK_PATH}/set-1`;
export const TRYOUT_SECTION_KEY = "penalaran-matematika";
export const TRYOUT_SECTION_PATH = `${TRYOUT_SET_PATH}/${TRYOUT_SECTION_KEY}`;
export const TRYOUT_SOURCE =
  "question-bank/tryout/indonesia/snbt/2027/set-1/penalaran-matematika";

/** Inserts the active Indonesia country row used by try-out tests. */
export async function insertTryoutCountry(ctx: MutationCtx) {
  return await ctx.db.insert("tryoutCountries", {
    countryKey: "indonesia",
    isActive: true,
    locale: "id",
    order: 1,
    publicPath: TRYOUT_COUNTRY_PATH,
    sourceRevision: "2026",
    syncedAt: TRYOUT_TEST_NOW,
    title: "Indonesia",
  });
}

/** Inserts one active exam row for a try-out test tree. */
export async function insertTryoutExam(ctx: MutationCtx, examKey = "snbt") {
  return await ctx.db.insert("tryoutExams", {
    countryKey: "indonesia",
    examKey,
    isActive: true,
    locale: "id",
    order: 1,
    publicPath: `${TRYOUT_COUNTRY_PATH}/${examKey}`,
    scoringStrategy: "irt",
    sourceRevision: "2026",
    syncedAt: TRYOUT_TEST_NOW,
    title: examKey.toUpperCase(),
  });
}

/** Inserts one track row with the supplied materialized readiness state. */
export async function insertTryoutTrack(
  ctx: MutationCtx,
  args: {
    examKey?: string;
    isReady?: boolean;
    publicPath?: string;
    trackKey?: string;
    trackKind?: "subject" | "year";
  } = {}
) {
  const examKey = args.examKey ?? "snbt";
  const trackKey = args.trackKey ?? "2027";

  return await ctx.db.insert("tryoutTracks", {
    authoredSetCount: 1,
    countryKey: "indonesia",
    examKey,
    isActive: true,
    isReady: args.isReady ?? true,
    locale: "id",
    order: 1,
    publicPath:
      args.publicPath ?? `${TRYOUT_COUNTRY_PATH}/${examKey}/${trackKey}`,
    readyQuestionCount: args.isReady === false ? 0 : 1,
    readySetCount: args.isReady === false ? 0 : 1,
    readyVisibleSectionCount: args.isReady === false ? 0 : 1,
    sourceRevision: "2026",
    syncedAt: TRYOUT_TEST_NOW,
    title: trackKey === "2027" ? "Tahun 2027" : "Matematika",
    trackKey,
    trackKind: args.trackKind ?? "year",
  });
}

/** Inserts one set row under a track using the public catalog contract. */
export async function insertTryoutSet(
  ctx: MutationCtx,
  args: {
    internalEntrySectionKey?: string;
    isReady?: boolean;
    order?: number;
    publicPath?: string;
    sectionCount?: number;
    setKey?: string;
    title?: string;
    totalQuestionCount?: number;
    trackKey?: string;
    visibleSectionCount?: number;
  } = {}
) {
  const trackKey = args.trackKey ?? "2027";
  const setKey = args.setKey ?? "set-1";
  const totalQuestionCount = args.totalQuestionCount ?? 1;
  const visibleSectionCount = args.visibleSectionCount ?? 1;

  return await ctx.db.insert("tryoutSets", {
    countryKey: "indonesia",
    examKey: "snbt",
    internalEntrySectionKey: args.internalEntrySectionKey,
    isActive: true,
    isReady: args.isReady ?? true,
    locale: "id",
    order: args.order ?? (setKey === "set-1" ? 1 : 2),
    publicPath: args.publicPath ?? `${TRYOUT_TRACK_PATH}/${setKey}`,
    readyQuestionCount: args.isReady === false ? 0 : totalQuestionCount,
    readyVisibleSectionCount: args.isReady === false ? 0 : visibleSectionCount,
    scoringStrategy: "irt",
    sectionCount: args.sectionCount ?? 1,
    setKey,
    sourceRevision: "2026",
    syncedAt: TRYOUT_TEST_NOW,
    title: args.title ?? (setKey === "set-1" ? "Set 1" : "Set 2"),
    totalQuestionCount,
    trackKey,
    visibleSectionCount,
  });
}

/** Inserts one question-set row and, optionally, a ready question row. */
export async function insertTryoutQuestionSource(
  ctx: MutationCtx,
  args: {
    questionCount?: number;
    sectionKey?: string;
    setKey?: string;
    sourcePath?: string;
    sourceRevision?: string;
    withQuestion?: boolean;
  } = {}
) {
  const sectionKey = args.sectionKey ?? TRYOUT_SECTION_KEY;
  const sourcePath = args.sourcePath ?? TRYOUT_SOURCE;
  const sourceRevision = args.sourceRevision ?? "2026";
  const questionCount = args.questionCount ?? 1;
  const questionSetId = await ctx.db.insert("questionSets", {
    contentHash: `${sourcePath}:hash`,
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    questionCount,
    sectionKey,
    setKey: args.setKey ?? "set-1",
    sourcePath,
    sourceRevision,
    syncedAt: TRYOUT_TEST_NOW,
    title: "Penalaran Matematika",
  });

  if (args.withQuestion ?? true) {
    await ctx.db.insert("questions", {
      answerBody: "Answer",
      contentHash: `${sourcePath}:question-hash`,
      date: 0,
      locale: "id",
      number: 1,
      questionBody: "Question",
      questionSetId,
      sourceKey: `${sourcePath}:question-1`,
      sourcePath: `${sourcePath}/question-1`,
      sourceRevision,
      syncedAt: TRYOUT_TEST_NOW,
      title: "Question",
    });
  }

  return questionSetId;
}

/** Inserts one try-out section row backed by a question-set source. */
export async function insertTryoutSection(
  ctx: MutationCtx,
  args: {
    order?: number;
    publicPath?: string;
    questionCount?: number;
    questionSetId: Id<"questionSets">;
    questionSourcePath?: string;
    sectionKey?: string;
    setKey?: string;
    sourceRevision?: string;
    trackKey?: string;
    tryoutSetId: Id<"tryoutSets">;
    visibility?: "internal-entry" | "visible";
  }
) {
  return await ctx.db.insert("tryoutSections", {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    order: args.order ?? 1,
    publicPath: args.publicPath,
    questionCount: args.questionCount ?? 1,
    questionSetId: args.questionSetId,
    questionSourcePath: args.questionSourcePath ?? TRYOUT_SOURCE,
    sectionKey: args.sectionKey ?? TRYOUT_SECTION_KEY,
    setKey: args.setKey ?? "set-1",
    sourceRevision: args.sourceRevision ?? "2026",
    syncedAt: TRYOUT_TEST_NOW,
    timeLimitSeconds: 1800,
    title: "Penalaran Matematika",
    trackKey: args.trackKey ?? "2027",
    tryoutSetId: args.tryoutSetId,
    visibility: args.visibility ?? "visible",
  });
}
