const CONTENT_RUNTIME_PATH = "/internal/content/runtime";

/** Canonical endpoint for current public content reads. */
export const PUBLIC_CONTENT_RUNTIME_PATH = CONTENT_RUNTIME_PATH;

/** Canonical endpoint for current public content batches. */
export const PUBLIC_CONTENT_RUNTIME_BATCH_PATH = `${PUBLIC_CONTENT_RUNTIME_PATH}/batch`;

/** Cohesive current material shell and body endpoint. */
export const MATERIAL_CONTENT_RUNTIME_PATH = `${CONTENT_RUNTIME_PATH}/material`;

/** Canonical unversioned endpoint for protected content reads. */
export const PROTECTED_CONTENT_RUNTIME_PATH = `${CONTENT_RUNTIME_PATH}/protected`;

/**
 * Marks responses built by the private runtime route after contract encoding.
 * This diagnostic signal does not replace signed response verification.
 *
 * @see https://docs.convex.dev/functions/http-actions
 */
export const CONTENT_RUNTIME_RESPONSE_HEADER = "x-nakafa-runtime-response";

/** Current private runtime response marker. */
export const CONTENT_RUNTIME_RESPONSE_MARKER = "1";
