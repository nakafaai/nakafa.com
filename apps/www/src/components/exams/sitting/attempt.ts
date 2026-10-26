import type { OptimisticLocalStore } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { HeldAttempt } from "@repo/backend/confect/exams/sittings/contract";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";

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

/** The sitting and the school of one student's attempt, which every call names. */
const SittingKey = Schema.Struct({
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/**
 * Marks the student's attempt submitted in the local store, when the store holds it, so the answers close
 * at once and Convex rolls the finish back when the server refuses it.
 */
export function finishInStore(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  key: typeof SittingKey.Type
) {
  const args = { sittingId: key.sittingId, slug: key.slug };
  const current = Option.getOrNull(
    localStore.getQuery(exams.sittings.student, args)
  );
  if (current !== null && current.attempt !== null) {
    localStore.setQuery(
      exams.sittings.student,
      args,
      Option.some({ ...current, attempt: finishAttempt(current.attempt) })
    );
  }
}
