import { Effect, MutableRef, Option, Schema } from "effect";
import { readTokenClaims } from "@/lib/auth/claims";

/**
 * The page's session as Nakafa reads it: whether Convex Auth's client is still
 * loading it, and the session and the account it names. `hasError` marks a
 * session read that could not complete.
 */
export const AuthSession = Schema.Struct({
  hasError: Schema.Boolean,
  isPending: Schema.Boolean,
  sessionId: Schema.NullOr(Schema.String),
  userId: Schema.NullOr(Schema.String),
});

export type AuthSession = typeof AuthSession.Type;

/** A signed-out session that never asks the backend, for authoring previews. */
export const previewAuthSession = AuthSession.make({
  hasError: false,
  isPending: false,
  sessionId: null,
  userId: null,
});

/**
 * Reads the state of Convex Auth's client (`AuthClient`) as the page's session.
 * The access token names the session; the account comes from the latest answer
 * of a sign-in or a refresh (`sessionUser`), which counts only for the session
 * it named. `hasError` marks a refresh that failed.
 */
export function readClientSession(
  state: {
    readonly hasError: boolean;
    readonly isLoading: boolean;
    readonly token: string | null;
  },
  user: { readonly sessionId: string; readonly userId: string } | null
) {
  const sessionId = Option.getOrNull(
    Option.map(
      Option.flatMap(Option.fromNullOr(state.token), readTokenClaims),
      ({ sub }) => sub
    )
  );
  return AuthSession.make({
    hasError: state.hasError,
    isPending: state.isLoading,
    sessionId,
    userId:
      sessionId !== null && user?.sessionId === sessionId ? user.userId : null,
  });
}

/**
 * Whether the page signs its account out. A page that signs out leaves by
 * loading another document, so its readers keep the session they saw until it
 * goes: following the client to signed out first would read every surface as a
 * visitor's for that moment, with a sign-in card where the learner's chat was.
 * Convex keeps answering the page's queries until then, because a query trusts
 * the token it holds.
 */
const signingOut = MutableRef.make(false);

/** Keeps the session every reader sees until the page leaves, because the page signs its account out. */
export const holdSession = Effect.fn("www.auth.holdSession")(function* () {
  yield* Effect.sync(() => MutableRef.set(signingOut, true));
});

/** Follows the client again, because the sign-out did not happen. */
export const releaseSession = Effect.fn("www.auth.releaseSession")(
  function* () {
    yield* Effect.sync(() => MutableRef.set(signingOut, false));
  }
);

/**
 * Follows the client's session from the session readers already see. While the
 * page signs its account out, readers keep the session they see
 * (`holdSession`). A read that failed keeps the session they see too, marked
 * with the error, so an outage never reads as signed out and a first read that
 * failed stays pending.
 */
export function followAuthSession(previous: AuthSession, next: AuthSession) {
  if (MutableRef.get(signingOut)) {
    return previous;
  }
  return next.hasError
    ? AuthSession.make({ ...previous, hasError: true })
    : next;
}
