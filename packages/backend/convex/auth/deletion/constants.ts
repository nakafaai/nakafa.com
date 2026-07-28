export const ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE =
  "ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER";

export const ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE =
  "ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE";

export const ACCOUNT_DELETION_ATTEMPT_HEADER =
  "x-nakafa-account-deletion-attempt";

/** Bounds one transaction without limiting how many schools can be processed. */
export const ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE = 20;

/** Bounds one successor scan page; opaque cursors continue larger schools. */
export const ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE = 50;

export const ACCOUNT_DELETION_RECOVERY_DELAY_MS = 15 * 60 * 1000;

export const ACCOUNT_DELETION_RECOVERY_RETRY_DELAY_MS = 60 * 60 * 1000;
