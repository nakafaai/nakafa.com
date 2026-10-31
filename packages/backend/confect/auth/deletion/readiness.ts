import authInternal from "@repo/backend/confect/_generated/refs/auth.server";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { ensurePostHogErasureConfigured } from "@repo/backend/confect/analytics/erasure/action";
import type { UserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE } from "@repo/backend/confect/auth/deletion/constants";
import {
  type AccountDeletionPreparationOutcome,
  accountDeletionPreparationOutcome,
} from "@repo/backend/confect/auth/deletion/spec";
import { APIError } from "better-auth/api";
import { Effect, Schema } from "effect";

/** The rejection that a deletion gets when its readiness cannot be confirmed. */
export const deletionUnavailableError = () =>
  APIError.from("INTERNAL_SERVER_ERROR", {
    code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
    message: "Account deletion is temporarily unavailable.",
  });

/**
 * Logs why one readiness step refused the deletion, with the whole cause,
 * before the step's failure becomes `deletionUnavailableError`. The browser
 * reads only that refusal, so this log is the one place that names the step.
 */
const logRefusal =
  (step: string) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.tapCause(self, (cause) =>
      Effect.logError(`Account deletion was refused at ${step}.`, cause)
    );

/** Requires the server-side claim to confirm deletion readiness. */
export const verifyAccountDeletionPreparation = Effect.fn(
  "auth.verifyAccountDeletionPreparation"
)(function* (
  preparation: Effect.Effect<
    AccountDeletionPreparationOutcome,
    UserCleanupError | Schema.SchemaError
  >
) {
  const preparationOutcome = yield* preparation.pipe(
    logRefusal("the deletion claim"),
    Effect.mapError(deletionUnavailableError),
    Effect.catchDefect(() => Effect.fail(deletionUnavailableError()))
  );
  if (
    preparationOutcome ===
    accountDeletionPreparationOutcome.temporarilyUnavailable
  ) {
    yield* Effect.logWarning(
      "Account deletion was refused at the deletion claim: the attempt's preparation was cancelled, finalized or belongs to another attempt."
    );
    return yield* Effect.fail(deletionUnavailableError());
  }
});

/** Runs the before-delete checks, then claims the irreversible deletion phase. */
export const ensureAccountDeletionReady = Effect.fn(
  "auth.ensureAccountDeletionReady"
)(function* (authId: string, rawAttemptId: string | null) {
  yield* ensurePostHogErasureConfigured().pipe(
    logRefusal("the PostHog erasure check"),
    Effect.mapError(deletionUnavailableError)
  );
  const attemptId = yield* Schema.decodeUnknownEffect(
    Schema.String.check(Schema.isUUID())
  )(rawAttemptId).pipe(
    logRefusal("the deletion attempt header"),
    Effect.mapError(deletionUnavailableError)
  );
  const { runMutation } = yield* MutationRunner;
  yield* verifyAccountDeletionPreparation(
    runMutation(authInternal.deletion.claimAccountDeletion, {
      attemptId,
      authId,
    })
  );
});
