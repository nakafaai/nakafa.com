import type { userValidator } from "@repo/backend/confect/users/schema";

type AccountDeletionState = Pick<typeof userValidator.Type, "deletedAt">;

/** Whether account writes and late side effects must already be quiesced: the account is deleted. */
export function isAccountDeletionPending(state: AccountDeletionState) {
  return state.deletedAt !== undefined;
}
