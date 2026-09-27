import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE } from "@repo/backend/confect/auth/deletion/constants";
import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";
/** Raised when a browser attempt cannot prove its reversible phase was canceled. */
export class AccountDeletionCancellationUnprovenError extends Schema.TaggedError<AccountDeletionCancellationUnprovenError>()(
  "AccountDeletionCancellationUnprovenError",
  {
    code: Schema.Literal(ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE),
    message: Schema.String,
  }
) {}
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const AccountDeletionCancellationUnprovenErrorWire = failureWire(
  AccountDeletionCancellationUnprovenError
);
export const accountDeletionRequestPhase = {
  deletion: "deletion",
  preparation: "preparation",
} as const;
const accountDeletionRequestPhaseSchema = Schema.Literals(
  Object.values(accountDeletionRequestPhase)
);
export type AccountDeletionRequestPhase = Schema.Schema.Type<
  typeof accountDeletionRequestPhaseSchema
>;
export const accountDeletionBrowserAttemptSchema = Schema.Struct({
  attemptId: Schema.String,
  phase: accountDeletionRequestPhaseSchema,
  userId: Schema.String,
});
export type AccountDeletionBrowserAttempt = Schema.Schema.Type<
  typeof accountDeletionBrowserAttemptSchema
>;
export const accountDeletionCancellationOutcome = {
  complete: "complete",
  continue: "continue",
} as const;
export const accountDeletionCancellationOutcomeValidator = Schema.Literals([
  ...Object.values(accountDeletionCancellationOutcome),
]);
export type AccountDeletionCancellationOutcome = Schema.Schema.Type<
  typeof accountDeletionCancellationOutcomeValidator
>;
export const accountDeletionPreparationOutcome = {
  continue: "continue",
  ready: "ready",
  schoolSuccessorRequired: "school-successor-required",
  temporarilyUnavailable: "temporarily-unavailable",
} as const;
export const accountDeletionPreparationOutcomeValidator = Schema.Literals([
  ...Object.values(accountDeletionPreparationOutcome),
]);
export type AccountDeletionPreparationOutcome = Schema.Schema.Type<
  typeof accountDeletionPreparationOutcomeValidator
>;
export const accountDeletionAttemptStatus = {
  committed: "committed",
  pending: "pending",
  unknown: "unknown",
} as const;
export const accountDeletionAttemptStatusValidator = Schema.Literals([
  ...Object.values(accountDeletionAttemptStatus),
]);
export type AccountDeletionAttemptStatus = Schema.Schema.Type<
  typeof accountDeletionAttemptStatusValidator
>;
export const accountDeletionPreparationVersionValidator = Schema.Struct({
  attemptId: Schema.String,
  preparationId: IdSchema("accountDeletionPreparations"),
  recoveryGeneration: Schema.Finite,
});
export type AccountDeletionPreparationVersion = Schema.Schema.Type<
  typeof accountDeletionPreparationVersionValidator
>;
