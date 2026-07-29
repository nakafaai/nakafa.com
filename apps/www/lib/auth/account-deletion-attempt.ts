import {
  type AccountDeletionBrowserAttempt,
  accountDeletionBrowserAttemptSchema,
  accountDeletionRequestPhase,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect, Schema } from "effect";

const accountDeletionAttemptStorageFailedCode =
  "ACCOUNT_DELETION_ATTEMPT_STORAGE_FAILED";
const accountDeletionAttemptStorageKey = "nakafa-account-deletion-attempt";
const persistedAccountDeletionAttemptSchema = Schema.parseJson(
  accountDeletionBrowserAttemptSchema
);
const decodePersistedAccountDeletionAttempt = Schema.decodeUnknown(
  persistedAccountDeletionAttemptSchema
);
const encodePersistedAccountDeletionAttempt = Schema.encode(
  persistedAccountDeletionAttemptSchema
);

interface AccountDeletionAttemptStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

/** Raised when the browser cannot durably retain its deletion capability. */
export class AccountDeletionAttemptStorageFailed extends Schema.TaggedError<AccountDeletionAttemptStorageFailed>()(
  "AccountDeletionAttemptStorageFailed",
  {
    code: Schema.Literal(accountDeletionAttemptStorageFailedCode),
  }
) {}

const accountDeletionAttemptStorageFailure = () =>
  new AccountDeletionAttemptStorageFailed({
    code: accountDeletionAttemptStorageFailedCode,
  });

const getAccountDeletionAttemptStorage = Effect.fn(
  "www.auth.getAccountDeletionAttemptStorage"
)(function* (storage?: AccountDeletionAttemptStorage) {
  if (storage) {
    return storage;
  }

  return yield* Effect.try({
    try: () => window.sessionStorage,
    catch: accountDeletionAttemptStorageFailure,
  });
});

/** Persists the opaque browser capability before an irreversible transition. */
export const saveAccountDeletionAttempt = Effect.fn(
  "www.auth.saveAccountDeletionAttempt"
)(function* (
  attempt: AccountDeletionBrowserAttempt,
  storage?: AccountDeletionAttemptStorage
) {
  const target = yield* getAccountDeletionAttemptStorage(storage);
  const encoded = yield* encodePersistedAccountDeletionAttempt(attempt).pipe(
    Effect.mapError(accountDeletionAttemptStorageFailure)
  );

  yield* Effect.try({
    try: () => target.setItem(accountDeletionAttemptStorageKey, encoded),
    catch: accountDeletionAttemptStorageFailure,
  });
});

/** Loads the tab-owned deletion capability, creating it before first use. */
export const loadOrCreateAccountDeletionAttempt = Effect.fn(
  "www.auth.loadOrCreateAccountDeletionAttempt"
)(function* (storage?: AccountDeletionAttemptStorage) {
  const target = yield* getAccountDeletionAttemptStorage(storage);
  const persisted = yield* Effect.try({
    try: () => target.getItem(accountDeletionAttemptStorageKey),
    catch: accountDeletionAttemptStorageFailure,
  });

  if (persisted !== null) {
    return yield* decodePersistedAccountDeletionAttempt(persisted, {
      onExcessProperty: "error",
    }).pipe(Effect.mapError(accountDeletionAttemptStorageFailure));
  }

  const attempt: AccountDeletionBrowserAttempt = {
    attemptId: yield* Effect.try({
      try: () => crypto.randomUUID(),
      catch: accountDeletionAttemptStorageFailure,
    }),
    phase: accountDeletionRequestPhase.preparation,
  };

  yield* saveAccountDeletionAttempt(attempt, target);
  return attempt;
});
