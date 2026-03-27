import type { Doc } from "@repo/backend/convex/_generated/dataModel";

type TryoutScoreTotals = Pick<
  Doc<"tryoutAttempts">,
  "totalCorrect" | "totalQuestions"
>;

/** Count how many persisted answers are marked correct. */
export function countCorrectAnswers(answers: Array<{ isCorrect: boolean }>) {
  return answers.reduce(
    (correctCount, answer) => correctCount + (answer.isCorrect ? 1 : 0),
    0
  );
}

/** Convert accumulated tryout score totals into a percentage. */
export function computeTryoutRawScorePercentage({
  totalCorrect,
  totalQuestions,
}: TryoutScoreTotals) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return (totalCorrect / totalQuestions) * 100;
}

/** Return the first ordered part index that has not been finalized yet. */
export function getFirstIncompleteTryoutPartIndex({
  completedPartIndices,
  partCount,
}: Pick<Doc<"tryoutAttempts">, "completedPartIndices"> &
  Pick<Doc<"tryouts">, "partCount">) {
  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    if (!completedPartIndices.includes(partIndex)) {
      return partIndex;
    }
  }

  return undefined;
}

/** Break ties between two completed leaderboard scores. */
export function isBetterLeaderboardScore(
  candidate: Pick<Doc<"tryoutAttempts">, "completedAt" | "theta">,
  currentBest: Pick<Doc<"tryoutAttempts">, "completedAt" | "theta">
) {
  if (candidate.theta !== currentBest.theta) {
    return candidate.theta > currentBest.theta;
  }

  return (candidate.completedAt ?? 0) > (currentBest.completedAt ?? 0);
}
