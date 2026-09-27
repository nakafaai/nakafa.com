interface AccountDeletionState {
  readonly deletedAt?: number;
  readonly deletionPreparedAt?: number;
}

/** Whether account writes and late side effects must already be quiesced. */
export function isAccountDeletionPending(state: AccountDeletionState) {
  return (
    state.deletedAt !== undefined || state.deletionPreparedAt !== undefined
  );
}
