/**
 * What the composer does with a message the learner submits. A submit never
 * stops an answer, so a key press in the text field keeps what the learner typed
 * while Nina answers. Only the stop button stops it.
 */
export function readComposerSubmit({
  busy,
  hasText,
  loading,
  pending,
  signedIn,
  userPending,
}: {
  busy: boolean;
  hasText: boolean;
  loading: boolean;
  pending: boolean;
  signedIn: boolean;
  userPending: boolean;
}): "keep" | "send" | "sign-in" {
  if (loading || pending || busy || userPending || !hasText) {
    return "keep";
  }
  return signedIn ? "send" : "sign-in";
}
