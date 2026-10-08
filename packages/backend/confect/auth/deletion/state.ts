import type { userValidator } from "@repo/backend/confect/users/schema";

type AccountDeletionState = Pick<
  typeof userValidator.Type,
  "deletedAt" | "deletionPreparedAt"
>;

/** Whether account writes and late side effects must already be quiesced. */
export function isAccountDeletionPending(state: AccountDeletionState) {
  return (
    state.deletedAt !== undefined || state.deletionPreparedAt !== undefined
  );
}
