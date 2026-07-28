export const ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE =
  "ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER";

export const ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE =
  "ACCOUNT_DELETION_PREPARATION_INCOMPLETE";

export const ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE =
  "ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE";

export const ACCOUNT_DELETION_ATTEMPT_HEADER =
  "x-nakafa-account-deletion-attempt";

/** Bounds one transaction without limiting how many schools can be processed. */
export const ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE = 20;

/** Bounds one successor scan page; opaque cursors continue larger schools. */
export const ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE = 50;

export const ACCOUNT_DELETION_RECOVERY_DELAY_MS = 15 * 60 * 1000;

/**
 * Reconciles external writes after every already-running Convex action must
 * have settled.
 * @see https://docs.convex.dev/production/state/limits#execution-time-and-scheduling
 */
export const ACCOUNT_DELETION_RECONCILIATION_DELAY_MS = 60 * 60 * 1000;

export const ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE = 20;

export const ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES = 5;

/** Keeps a privacy-minimal commit receipt long enough for browser retries. */
export const ACCOUNT_DELETION_RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const ACCOUNT_DELETION_RECEIPT_SWEEP_BATCH_SIZE = 50;

export const ACCOUNT_DELETION_RECEIPT_SWEEP_INTERVAL_HOURS = 24;
