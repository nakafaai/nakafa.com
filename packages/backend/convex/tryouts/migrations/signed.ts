import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { migrationFail } from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;

/** Detects frozen section references created by the filesystem runtime. */
export function hasLegacySectionSource(attempt: TryoutAttempt) {
  return attempt.sectionSnapshots.some(
    (section) =>
      section.questionSetId !== undefined ||
      section.tryoutSectionId !== undefined
  );
}

/** Checks the complete signed root identity written by native or migrated starts. */
export function isSignedAttempt(
  attempt: TryoutAttempt,
  expectedSnapshotId: string
) {
  if (
    attempt.tryoutSnapshotId !== expectedSnapshotId ||
    attempt.countryKey === undefined ||
    attempt.examKey === undefined ||
    attempt.trackKey === undefined ||
    attempt.setKey === undefined ||
    attempt.locale === undefined
  ) {
    return false;
  }

  const setIdentity = tryoutCatalogIdentity({
    countryKey: attempt.countryKey,
    examKey: attempt.examKey,
    kind: "set",
    locale: attempt.locale,
    setKey: attempt.setKey,
    trackKey: attempt.trackKey,
  });
  if (attempt.setIdentity !== setIdentity) {
    return false;
  }

  const sectionKeys = new Set<string>();
  let questionCount = 0;
  for (const section of attempt.sectionSnapshots) {
    const sectionIdentity = tryoutCatalogIdentity({
      countryKey: attempt.countryKey,
      examKey: attempt.examKey,
      kind: "section",
      locale: attempt.locale,
      sectionKey: section.sectionKey,
      setKey: attempt.setKey,
      trackKey: attempt.trackKey,
    });
    if (
      section.sectionIdentity !== sectionIdentity ||
      section.sectionRowHash === undefined ||
      sectionKeys.has(section.sectionKey)
    ) {
      return false;
    }
    sectionKeys.add(section.sectionKey);
    questionCount += section.questionCount;
  }

  return questionCount === attempt.totalQuestions;
}

/** Loads one parent attempt and requires its exact signed snapshot identity. */
export const requireSignedAttempt = Effect.fn(
  "tryouts.migrations.requireSignedAttempt"
)(function* (
  ctx: QueryCtx,
  attemptId: Id<"tryoutAttempts">,
  expectedSnapshotId: string
) {
  const attempt = yield* Effect.promise(() => ctx.db.get(attemptId));
  if (!(attempt && isSignedAttempt(attempt, expectedSnapshotId))) {
    return yield* migrationFail(
      "A signed migration row lost its exact parent attempt."
    );
  }
  return attempt;
});

/** Derives the stable signed set identity from one progress route. */
export function getProgressIdentity(progress: Doc<"tryoutSetProgress">) {
  return tryoutCatalogIdentity({
    countryKey: progress.countryKey,
    examKey: progress.examKey,
    kind: "set",
    locale: progress.locale,
    setKey: progress.setKey,
    trackKey: progress.trackKey,
  });
}

/** Checks that one progress row belongs to its exact signed attempt. */
export function isSignedProgress(
  progress: Doc<"tryoutSetProgress">,
  attempt: TryoutAttempt,
  expectedSnapshotId: string
) {
  const identity = getProgressIdentity(progress);
  return (
    isSignedAttempt(attempt, expectedSnapshotId) &&
    attempt._id === progress.latestAttemptId &&
    attempt.setIdentity === identity &&
    progress.setIdentity === identity
  );
}

/** Checks one immutable placement selector against its frozen parent section. */
export function isSignedPlacement(
  placement: Doc<"tryoutAttemptPlacements">,
  attempt: TryoutAttempt
) {
  const section = attempt.sectionSnapshots.find(
    (candidate) => candidate.sectionKey === placement.sectionKey
  );
  return (
    placement.answerArtifactHash !== undefined &&
    placement.answerContentKey !== undefined &&
    placement.placementIdentity !== undefined &&
    placement.placementRowHash !== undefined &&
    placement.questionArtifactHash !== undefined &&
    placement.questionContentKey !== undefined &&
    placement.rendererDomain !== undefined &&
    placement.sectionIdentity !== undefined &&
    placement.sectionKey !== undefined &&
    section?.sectionIdentity === placement.sectionIdentity &&
    placement.questionOrder > 0 &&
    placement.questionOrder <= section.questionCount
  );
}

/** Checks one signed section attempt against its frozen parent section. */
export function isSignedSectionAttempt(
  sectionAttempt: Doc<"tryoutSectionAttempts">,
  attempt: TryoutAttempt
) {
  const section = attempt.sectionSnapshots.find(
    (candidate) => candidate.sectionKey === sectionAttempt.sectionKey
  );
  if (!section) {
    return false;
  }
  return (
    sectionAttempt.sectionIdentity !== undefined &&
    sectionAttempt.sectionIdentity === section.sectionIdentity &&
    sectionAttempt.sectionOrder === section.sectionOrder &&
    sectionAttempt.totalQuestions === section.questionCount
  );
}

/** Checks one exact native signed IRT scale. */
export function isSignedScale(
  scale: Doc<"irtScaleVersions">,
  expectedSnapshotId: string
) {
  return (
    scale.tryoutSnapshotId === expectedSnapshotId &&
    scale.setIdentity !== undefined
  );
}

/** Checks the immutable placement identity stored on one signed scale item. */
export function isSignedScaleItem(item: Doc<"irtScaleItems">) {
  return (
    item.placementIdentity !== undefined && item.placementRowHash !== undefined
  );
}

/** Checks one native calibration run against its exact signed scale. */
export function isSignedCalibration(
  run: Doc<"irtCalibrationRuns">,
  scale: Doc<"irtScaleVersions">,
  expectedSnapshotId: string
) {
  return (
    isSignedScale(scale, expectedSnapshotId) &&
    run.scaleVersionId === scale._id &&
    run.sectionIdentity !== undefined
  );
}

/** Checks one score snapshot against its exact signed parent attempt. */
export function isSignedScore(
  score: Doc<"tryoutScores">,
  attempt: TryoutAttempt,
  expectedSnapshotId: string
) {
  return (
    isSignedAttempt(attempt, expectedSnapshotId) &&
    score.tryoutSnapshotId === expectedSnapshotId &&
    score.setIdentity === attempt.setIdentity &&
    score.tryoutSetId === attempt.tryoutSetId &&
    score.scaleVersionId === attempt.scaleVersionId &&
    score.userId === attempt.userId &&
    score.scoringStrategy === attempt.scoringStrategy &&
    score.scoreStatus === attempt.scoreStatus &&
    score.totalCorrect === attempt.totalCorrect &&
    score.totalQuestions === attempt.totalQuestions &&
    score.finalizedAt === attempt.completedAt
  );
}
