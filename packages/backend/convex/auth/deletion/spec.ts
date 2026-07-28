import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const accountDeletionPreparationOutcome = {
  continue: "continue",
  ready: "ready",
  schoolSuccessorRequired: "school-successor-required",
  temporarilyUnavailable: "temporarily-unavailable",
} as const;

export const accountDeletionPreparationOutcomeValidator = literals(
  ...Object.values(accountDeletionPreparationOutcome)
);

export type AccountDeletionPreparationOutcome = Infer<
  typeof accountDeletionPreparationOutcomeValidator
>;

export const accountDeletionAttemptStatus = {
  committed: "committed",
  pending: "pending",
  unknown: "unknown",
} as const;

export const accountDeletionAttemptStatusValidator = literals(
  ...Object.values(accountDeletionAttemptStatus)
);

export type AccountDeletionAttemptStatus = Infer<
  typeof accountDeletionAttemptStatusValidator
>;

export const accountDeletionPreparationVersionValidator = v.object({
  attemptId: v.string(),
  preparationId: v.id("accountDeletionPreparations"),
  recoveryGeneration: v.number(),
});

export type AccountDeletionPreparationVersion = Infer<
  typeof accountDeletionPreparationVersionValidator
>;
