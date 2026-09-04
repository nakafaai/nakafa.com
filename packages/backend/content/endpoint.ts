const CONTENT_RUNTIME_PATH = "/internal/content/runtime";

/** Canonical endpoint for current public content reads. */
export const PUBLIC_CONTENT_RUNTIME_PATH = CONTENT_RUNTIME_PATH;

/** Canonical endpoint for current public content batches. */
export const PUBLIC_CONTENT_RUNTIME_BATCH_PATH = `${PUBLIC_CONTENT_RUNTIME_PATH}/batch`;

/** Canonical unversioned endpoint for protected content reads. */
export const PROTECTED_CONTENT_RUNTIME_PATH = `${CONTENT_RUNTIME_PATH}/protected`;

const CONTENT_RUNTIME_ARCHIVE_PATH = `${CONTENT_RUNTIME_PATH}/archive`;

/** Producer-only lease acquisition before an expensive runtime export. */
export const CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH = `${CONTENT_RUNTIME_ARCHIVE_PATH}/claim`;

/** Authenticated capability creation for one encrypted runtime upload. */
export const CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH = `${CONTENT_RUNTIME_ARCHIVE_PATH}/upload`;

/** Authenticated immutable binding for one completed runtime upload. */
export const CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH = `${CONTENT_RUNTIME_ARCHIVE_PATH}/finalize`;

/** Producer-only cleanup for one upload whose final state is uncertain. */
export const CONTENT_RUNTIME_ARCHIVE_ABORT_PATH = `${CONTENT_RUNTIME_ARCHIVE_PATH}/abort`;

/** Producer-only release for an export lease that did not publish. */
export const CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH = `${CONTENT_RUNTIME_ARCHIVE_PATH}/release`;

/** Authenticated download boundary for one immutable runtime archive. */
export const CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH = `${CONTENT_RUNTIME_ARCHIVE_PATH}/download`;

/**
 * Marks responses built by the private runtime route after contract encoding.
 * This diagnostic signal does not replace signed response verification.
 *
 * @see https://docs.convex.dev/functions/http-actions
 */
export const CONTENT_RUNTIME_RESPONSE_HEADER = "x-nakafa-runtime-response";

/** Current private runtime response marker. */
export const CONTENT_RUNTIME_RESPONSE_MARKER = "1";
