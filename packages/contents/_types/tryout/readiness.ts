import type { TryoutSetSource } from "@repo/contents/_types/tryout/schema";

/** Returns the authored question total that determines whether a set is publishable. */
export function getTryoutSetQuestionCount(set: TryoutSetSource) {
  return set.sections.reduce(
    (total, section) => total + section.questionCount,
    0
  );
}

/** Returns whether an authored set has questions and can own public routes. */
export function isTryoutSetReady(set: TryoutSetSource) {
  return getTryoutSetQuestionCount(set) > 0;
}
