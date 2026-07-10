import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { TRYOUT_CHOICE_LIMIT } from "@repo/backend/convex/tryouts/questions";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutQuestion = Doc<"questions">;
type TryoutSection = Doc<"tryoutSections">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Loads the immutable section snapshot for one attempt section key. */
export function requireSectionSnapshot(
  attempt: TryoutAttempt,
  sectionKey: string
): TryoutSectionSnapshot {
  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.sectionKey === sectionKey
  );

  if (!snapshot) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section is not part of this attempt.",
    });
  }

  return snapshot;
}

/** Loads the live section row backing an attempt snapshot. */
export async function requireSnapshotSection(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    snapshot: TryoutSectionSnapshot;
  }
): Promise<TryoutSection> {
  const section = await ctx.db.get(args.snapshot.tryoutSectionId);

  if (
    !section ||
    section.tryoutSetId !== args.attempt.tryoutSetId ||
    section.sectionKey !== args.snapshot.sectionKey ||
    section.questionSetId !== args.snapshot.questionSetId ||
    section.questionSourcePath !== args.snapshot.questionSourcePath ||
    section.questionCount !== args.snapshot.questionCount ||
    section.sourceRevision !== args.snapshot.sourceRevision
  ) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section not found.",
    });
  }

  return section;
}

/** Freezes every question placement when an attempt starts. */
export async function createAttemptPlacements(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt }
) {
  for (const snapshot of args.attempt.sectionSnapshots) {
    const section = await requireSnapshotSection(ctx, {
      attempt: args.attempt,
      snapshot,
    });

    await createSectionPlacements(ctx, {
      attempt: args.attempt,
      section,
    });
  }
}

/** Creates the immutable placements for one snapshotted section. */
async function createSectionPlacements(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; section: TryoutSection }
) {
  const questions = await loadSectionQuestions(ctx, args.section);
  const snapshots = await Promise.all(
    questions.map(async (question) => ({
      choiceSnapshots: await loadChoiceSnapshots(ctx, question),
      question,
    }))
  );

  for (const snapshot of snapshots) {
    const { choiceSnapshots, question } = snapshot;
    await ctx.db.insert("tryoutAttemptPlacements", {
      choiceSnapshots,
      contentHash: question.contentHash,
      questionId: question._id,
      questionOrder: question.number,
      questionSourceKey: question.sourceKey,
      sourcePath: question.sourcePath,
      sourceRevision: question.sourceRevision,
      title: question.title,
      tryoutAttemptId: args.attempt._id,
      tryoutSectionId: args.section._id,
    });
  }
}

/** Loads the ordered question rows for one section. */
async function loadSectionQuestions(ctx: MutationCtx, section: TryoutSection) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (q) =>
      q.eq("questionSetId", section.questionSetId)
    )
    .take(section.questionCount + 1);

  if (questions.length !== section.questionCount) {
    throw new ConvexError({
      code: "TRYOUT_QUESTION_COUNT_MISMATCH",
      message: "Try-out section question count is not synced.",
    });
  }

  const hasMixedRevision = questions.some(
    (question) => question.sourceRevision !== section.sourceRevision
  );

  if (hasMixedRevision) {
    throw new ConvexError({
      code: "TRYOUT_QUESTION_SNAPSHOT_MISMATCH",
      message: "Try-out section questions are not fully synced.",
    });
  }

  return questions;
}

/** Loads the ordered choice snapshot for one runtime placement. */
async function loadChoiceSnapshots(ctx: MutationCtx, question: TryoutQuestion) {
  const choices = await ctx.db
    .query("questionChoices")
    .withIndex("by_questionId_and_locale", (q) =>
      q.eq("questionId", question._id).eq("locale", question.locale)
    )
    .take(TRYOUT_CHOICE_LIMIT + 1);

  if (choices.length > TRYOUT_CHOICE_LIMIT) {
    throw new ConvexError({
      code: "TRYOUT_CHOICE_COUNT_EXCEEDED",
      message: "Try-out question choice count exceeds the sync limit.",
    });
  }

  if (choices.length === 0) {
    throw new ConvexError({
      code: "TRYOUT_CHOICE_COUNT_MISMATCH",
      message: "Try-out question has no synced choices.",
    });
  }

  return choices
    .map((choice) => ({
      isCorrect: choice.isCorrect,
      label: choice.label,
      optionKey: choice.optionKey,
      order: choice.order,
    }))
    .sort((left, right) => left.order - right.order);
}
