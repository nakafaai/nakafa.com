import refs from "@repo/backend/confect/_generated/refs";
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
    Effect.mapError(deletionUnavailableError),
    Effect.catchDefect(() => Effect.fail(deletionUnavailableError()))
  );
  if (
    preparationOutcome ===
    accountDeletionPreparationOutcome.temporarilyUnavailable
  ) {
    return yield* Effect.fail(deletionUnavailableError());
  }
});

/** Runs the before-delete checks, then claims the irreversible deletion phase. */
export const ensureAccountDeletionReady = Effect.fn(
  "auth.ensureAccountDeletionReady"
)(function* (authId: string, rawAttemptId: string | null) {
  yield* ensurePostHogErasureConfigured().pipe(
    Effect.mapError(deletionUnavailableError)
  );
  const attemptId = yield* Schema.decodeUnknownEffect(
    Schema.String.check(Schema.isUUID())
  )(rawAttemptId).pipe(Effect.mapError(deletionUnavailableError));
  const { runMutation } = yield* MutationRunner;
  yield* verifyAccountDeletionPreparation(
    runMutation(refs.internal.auth.deletion.claimAccountDeletion, {
      attemptId,
      authId,
    })
  );
});
