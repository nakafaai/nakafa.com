export const ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE =
  "ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE";
export const ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE =
  "ACCOUNT_DELETION_CANCELLATION_UNPROVEN";
export const ACCOUNT_DELETION_ATTEMPT_HEADER =
  "x-nakafa-account-deletion-attempt";

/** Bounds one Better Auth deletion page inside one transaction. */
export const ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE = 20;
export const ACCOUNT_DELETION_RECOVERY_DELAY_MS = 15 * 60 * 1000;

/**
 * Reconciles external writes after every already-running Convex action must
 * have settled.
 * @see https://docs.convex.dev/production/state/limits#execution-time-and-scheduling
 */
export const ACCOUNT_DELETION_RECONCILIATION_DELAY_MS = 60 * 60 * 1000;
export const ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE = 20;
export const ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES = 5;

/** Keeps opaque attempt outcomes long enough to reject delayed browser replays. */
export const ACCOUNT_DELETION_ATTEMPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE = 50;
export const ACCOUNT_DELETION_ATTEMPT_SWEEP_INTERVAL_HOURS = 24;
