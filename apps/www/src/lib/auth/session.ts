import { Effect, MutableRef, Option, Predicate, Schema } from "effect";

/** The Better Auth route that reports the session of the cookie a request sends. */
export const SESSION_PATH = "/api/auth/get-session";

/**
 * The Better Auth session as Nakafa reads it.
 *
 * `hasError` marks a session request Better Auth could not complete; it keeps
 * the last known session ids, as Better Auth does for a failed refresh.
 */
export const AuthSession = Schema.Struct({
  hasError: Schema.Boolean,
  isPending: Schema.Boolean,
  sessionId: Schema.NullOr(Schema.String),
  userId: Schema.NullOr(Schema.String),
});

export type AuthSession = typeof AuthSession.Type;

/**
 * The value of Better Auth's session atom, which `authClient.useSession()`
 * returns. Only the fields Nakafa reads are decoded.
 */
const BetterAuthSession = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      session: Schema.Struct({ id: Schema.String }),
      user: Schema.Struct({ id: Schema.String }),
    })
  ),
  error: Schema.Unknown,
  isPending: Schema.Boolean,
});

const decodeBetterAuthSession = Schema.decodeUnknownOption(BetterAuthSession);

/**
 * The atom while Better Auth refetches a session it holds no data for. It
 * marks such a session pending again, as on every return to the tab.
 */
const BetterAuthRefetch = Schema.Struct({
  data: Schema.Null,
  isPending: Schema.Literal(true),
  isRefetching: Schema.Literal(true),
});

const isBetterAuthRefetch = Schema.is(BetterAuthRefetch);

/** A signed-out session that never asks the backend, for authoring previews. */
export const previewAuthSession = AuthSession.make({
  hasError: false,
  isPending: false,
  sessionId: null,
  userId: null,
});

/**
 * Reads one value of Better Auth's session atom.
 *
 * A value outside Better Auth's session contract reads as a failed session
 * request, so readers treat it like any other unavailable session.
 */
export function readAuthSession(value: unknown) {
  return decodeBetterAuthSession(value).pipe(
    Option.match({
      onNone: () =>
        AuthSession.make({
          hasError: true,
          isPending: false,
          sessionId: null,
          userId: null,
        }),
      onSome: ({ data, error, isPending }) =>
        AuthSession.make({
          hasError: Predicate.isNotNullish(error),
          isPending,
          sessionId: data?.session.id ?? null,
          userId: data?.user.id ?? null,
        }),
    })
  );
}

/**
 * Whether the page signs its account out. A page that signs out leaves by
 * loading another document, so its readers keep the session they saw until it
 * goes: following Better Auth to signed out first would read every surface as a
 * visitor's for that moment, with a sign-in card where the learner's chat was.
 * Convex keeps answering the page's queries until then, because a query trusts
 * the token it holds.
 */
const signingOut = MutableRef.make(false);

/** Keeps the session every reader sees until the page leaves, because the page signs its account out. */
export const holdSession = Effect.fn("www.auth.holdSession")(function* () {
  yield* Effect.sync(() => MutableRef.set(signingOut, true));
});

/** Follows Better Auth again, because the sign-out did not happen. */
export const releaseSession = Effect.fn("www.auth.releaseSession")(
  function* () {
    yield* Effect.sync(() => MutableRef.set(signingOut, false));
  }
);

/**
 * Follows Better Auth's session atom from the session readers already see.
 *
 * Once the session has settled, a refetch of a signed-out session keeps that
 * session until Better Auth answers, so readers never fall back to loading.
 * While the page signs its account out, readers keep the session they see
 * (`holdSession`).
 */
export function followAuthSession(previous: AuthSession, value: unknown) {
  if (MutableRef.get(signingOut)) {
    return previous;
  }
  return !previous.isPending && isBetterAuthRefetch(value)
    ? previous
    : readAuthSession(value);
}
