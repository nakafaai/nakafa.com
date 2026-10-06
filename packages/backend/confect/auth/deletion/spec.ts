import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE } from "@repo/backend/confect/auth/deletion/constants";
import { Schema } from "effect";
/** Raised when a browser attempt cannot prove its reversible phase was canceled. */
export class AccountDeletionCancellationUnprovenError extends Schema.TaggedError<AccountDeletionCancellationUnprovenError>()(
  "AccountDeletionCancellationUnprovenError",
  {
    code: Schema.Literal(ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE),
    message: Schema.String,
  }
) {}

export const accountDeletionRequestPhase = {
  deletion: "deletion",
  preparation: "preparation",
} as const;
const accountDeletionRequestPhaseSchema = Schema.Literals(
  Object.values(accountDeletionRequestPhase)
);
export type AccountDeletionRequestPhase =
  typeof accountDeletionRequestPhaseSchema.Type;
export const accountDeletionBrowserAttemptSchema = Schema.Struct({
  attemptId: Schema.String,
  phase: accountDeletionRequestPhaseSchema,
  userId: Schema.String,
});
export type AccountDeletionBrowserAttempt =
  typeof accountDeletionBrowserAttemptSchema.Type;
export const accountDeletionCancellationOutcome = {
  complete: "complete",
  continue: "continue",
} as const;
export const accountDeletionCancellationOutcomeValidator = Schema.Literals([
  ...Object.values(accountDeletionCancellationOutcome),
]);
export type AccountDeletionCancellationOutcome =
  typeof accountDeletionCancellationOutcomeValidator.Type;
export const accountDeletionPreparationOutcome = {
  continue: "continue",
  ready: "ready",
  schoolSuccessorRequired: "school-successor-required",
  temporarilyUnavailable: "temporarily-unavailable",
} as const;
export const accountDeletionPreparationOutcomeValidator = Schema.Literals([
  ...Object.values(accountDeletionPreparationOutcome),
]);
export type AccountDeletionPreparationOutcome =
  typeof accountDeletionPreparationOutcomeValidator.Type;
export const accountDeletionAttemptStatus = {
  committed: "committed",
  pending: "pending",
  unknown: "unknown",
} as const;
export const accountDeletionAttemptStatusValidator = Schema.Literals([
  ...Object.values(accountDeletionAttemptStatus),
]);
export type AccountDeletionAttemptStatus =
  typeof accountDeletionAttemptStatusValidator.Type;
export const accountDeletionPreparationVersionValidator = Schema.Struct({
  attemptId: Schema.String,
  preparationId: IdSchema("accountDeletionPreparations"),
  recoveryGeneration: Schema.Finite,
});
export type AccountDeletionPreparationVersion =
  typeof accountDeletionPreparationVersionValidator.Type;
