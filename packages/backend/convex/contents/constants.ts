/** Number of sealed view events processed in one drain mutation. */
export const CONTENT_VIEW_EVENT_BATCH_SIZE = 250;

/** Duration of one append-only view event segment. */
export const CONTENT_VIEW_EVENT_SEGMENT_MS = 10 * 1000;

/** Cron cadence for draining sealed view event segments. */
export const CONTENT_VIEW_EVENT_CRON_INTERVAL_SECONDS = 10;
