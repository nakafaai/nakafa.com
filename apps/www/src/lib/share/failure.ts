/**
 * Whether one read of a share link shows a failure that is new. The reader keeps
 * the failure that it showed last, and `failure` is the failure of the read now,
 * each as the tag of the error, or null when the read did not fail.
 *
 * A failure that is the same as the last one is not new. A retry remounts the
 * reader, which finds the failure the cache still holds until the server answers,
 * so the failure at a mount is not new either. A failure that appears after the
 * mount is new, and so is a failure that follows a read that did not fail.
 */
export function isNewLinkFailure(seen: string | null, failure: string | null) {
  return failure !== null && failure !== seen;
}
