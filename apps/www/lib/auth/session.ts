import { Option, Predicate, Schema } from "effect";

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
