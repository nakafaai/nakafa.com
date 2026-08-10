/** Private Convex endpoint for active public content reads. */
export const PUBLIC_CONTENT_RUNTIME_PATH = "/internal/content/runtime";

/** Private Convex endpoint for retained protected content reads. */
export const PROTECTED_CONTENT_RUNTIME_PATH = `${PUBLIC_CONTENT_RUNTIME_PATH}/protected`;

/**
 * Marks responses built by the private runtime route after contract encoding.
 * This diagnostic signal does not replace signed response verification.
 *
 * @see https://docs.convex.dev/functions/http-actions
 */
export const CONTENT_RUNTIME_RESPONSE_HEADER = "x-nakafa-runtime-response";

/** Current private runtime response marker. */
export const CONTENT_RUNTIME_RESPONSE_MARKER = "1";
