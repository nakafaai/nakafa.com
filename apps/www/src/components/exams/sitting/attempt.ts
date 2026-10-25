import type { HeldAttempt } from "@repo/backend/confect/exams/sittings/contract";

/** The student's own attempt, as the student's screen holds it. */
export type AttemptValue = typeof HeldAttempt.Type;

/**
 * The whole seconds that are left until the deadline, never below zero. A part of a second
 * counts as a whole one, so the last second still shows.
 */
export function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * Whether the attempt is active, which is when it still takes answers or signals, or when a
 * proctor has locked it for a moment. The timer shows only for an active attempt.
 */
export function isActive(state: AttemptValue["state"]): boolean {
  return state === "inProgress" || state === "locked";
}

/** The attempt as it is once the student finishes, which closes it for good. */
export function finishAttempt(attempt: AttemptValue): AttemptValue {
  return { ...attempt, state: "submitted" };
}

/** Whether the attempt takes answers now, which is only while it is in progress. */
export function takesAnswers(state: AttemptValue["state"]): boolean {
  return state === "inProgress";
}
