/** Bounds one page of an account's records that a deletion step changes inside one transaction. */
export const ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE = 20;

/**
 * Reconciles external writes after every already-running Convex action must
 * have settled.
 * @see https://docs.convex.dev/production/state/limits#execution-time-and-scheduling
 */
export const ACCOUNT_DELETION_RECONCILIATION_DELAY_MS = 60 * 60 * 1000;
