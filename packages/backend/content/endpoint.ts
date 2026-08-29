const CONTENT_RUNTIME_PATH = "/internal/content/runtime";

/** Canonical endpoint for current public content reads. */
export const PUBLIC_CONTENT_RUNTIME_PATH = CONTENT_RUNTIME_PATH;

/** Canonical endpoint for current public content batches. */
export const PUBLIC_CONTENT_RUNTIME_BATCH_PATH = `${PUBLIC_CONTENT_RUNTIME_PATH}/batch`;

/** Protected endpoint retained until the deployed predecessor stops calling it. */
export const PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH = `${CONTENT_RUNTIME_PATH}/protected`;

/** Versioned endpoint for permanent-bundle protected content reads. */
export const PROTECTED_CONTENT_RUNTIME_PATH = `${CONTENT_RUNTIME_PATH}/v2/protected`;

/** Retained-history endpoint used by the deployed predecessor web client. */
export const PREDECESSOR_RETAINED_PROTECTED_CONTENT_RUNTIME_PATH = `${PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH}/history`;

/** Private attempt-bound endpoint for immutable retained-history reads. */
export const RETAINED_PROTECTED_CONTENT_RUNTIME_PATH = `${PROTECTED_CONTENT_RUNTIME_PATH}/history`;

/**
 * Marks responses built by the private runtime route after contract encoding.
 * This diagnostic signal does not replace signed response verification.
 *
 * @see https://docs.convex.dev/functions/http-actions
 */
export const CONTENT_RUNTIME_RESPONSE_HEADER = "x-nakafa-runtime-response";

/** Current private runtime response marker. */
export const CONTENT_RUNTIME_RESPONSE_MARKER = "1";
