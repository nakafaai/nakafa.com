/**
 * Convex upload URLs expire after one hour. Keeping a second hour for an
 * already-started upload to settle ensures deletion never removes its claim
 * while the signed capability can still create storage.
 *
 * @see https://docs.convex.dev/file-storage/upload-files
 */
export const FORUM_PENDING_UPLOAD_SETTLEMENT_WINDOW_MS = 2 * 60 * 60 * 1000;
