/** Counts correct answers in an exercise answer set. */
export function countCorrectAnswers(
  answers: readonly { readonly isCorrect: boolean }[]
) {
  return answers.reduce(
    (correctCount, answer) => correctCount + (answer.isCorrect ? 1 : 0),
    0
  );
}

/** Computes the public raw score percentage for a finalized tryout. */
export function computeTryoutRawScorePercentage(args: {
  readonly totalCorrect: number;
  readonly totalQuestions: number;
}) {
  if (args.totalQuestions <= 0) {
    return 0;
  }

  return (args.totalCorrect / args.totalQuestions) * 100;
}

/** Finds the first incomplete part index for resume navigation. */
export function getFirstIncompleteTryoutPartIndex(args: {
  readonly completedPartIndices: readonly number[];
  readonly partCount: number;
}) {
  for (let partIndex = 0; partIndex < args.partCount; partIndex += 1) {
    if (!args.completedPartIndices.includes(partIndex)) {
      return partIndex;
    }
  }

  return;
}

/** Chooses the better leaderboard score, breaking theta ties by recency. */
export function isBetterLeaderboardScore(
  candidate: { readonly completedAt?: number | null; readonly theta: number },
  currentBest: { readonly completedAt?: number | null; readonly theta: number }
) {
  if (candidate.theta !== currentBest.theta) {
    return candidate.theta > currentBest.theta;
  }

  return (candidate.completedAt ?? 0) > (currentBest.completedAt ?? 0);
}
