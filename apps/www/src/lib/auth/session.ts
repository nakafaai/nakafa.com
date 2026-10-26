import { Option, Predicate, Schema } from "effect";

/** The Better Auth route that reports the session of the cookie a request sends. */
export const SESSION_PATH = "/api/auth/get-session";

/**
 * The Better Auth session as Nakafa reads it.
 *
 * `hasError` marks a session request Better Auth could not complete; it keeps
 * the last known session ids, as Better Auth does for a failed refresh. A failed
 * request that knew no session stays pending (`readAuthSession`).
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

/** A signed-out session that never asks the backend, for authoring previews. */
export const previewAuthSession = AuthSession.make({
  hasError: false,
  isPending: false,
  sessionId: null,
  userId: null,
});

/** Better Auth's answer that the cookie holds no session, the one failure it settles as signed out. */
const UnauthorizedAnswer = Schema.Struct({ status: Schema.Literal(401) });

const isUnauthorizedAnswer = Schema.is(UnauthorizedAnswer);

/**
 * Reads one value of Better Auth's session atom.
 *
 * A failed request that knew no session, a network failure or a 5xx on a page's
 * first read, said nothing about the session, so it stays pending: Better Auth
 * itself keeps its last session for every failure but a 401, and a reader that
 * took it as signed out would read the school or the account without a token and
 * flash an error until the next answer. A 401 is signed out.
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
          isPending:
            isPending ||
            (data === null &&
              Predicate.isNotNullish(error) &&
              !isUnauthorizedAnswer(error)),
          sessionId: data?.session.id ?? null,
          userId: data?.user.id ?? null,
        }),
    })
  );
}

/**
 * Follows Better Auth's session atom from the session readers already see.
 *
 * Once the session has settled, a value that says nothing about it keeps that
 * session, so readers never fall back to loading: Better Auth marks a session it
 * holds no data for pending again while it refetches it, on every return to the
 * tab, and a refetch that fails without an answer reads as pending too.
 */
export function followAuthSession(previous: AuthSession, value: unknown) {
  const next = readAuthSession(value);
  return !previous.isPending && next.isPending && next.sessionId === null
    ? previous
    : next;
}
