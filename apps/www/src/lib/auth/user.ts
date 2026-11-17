import { Effect, Option, Schema } from "effect";
import { createStore } from "zustand/vanilla";
import { readTokenClaims } from "@/lib/auth/claims";
import { SESSION_USER_KEY } from "@/lib/auth/keys";
import { SessionUser } from "@/lib/auth/session";

/** The account the browser stored for its last session, or none when storage holds none, refuses, or is absent, as on the server. */
const loadSessionUser = () =>
  Effect.runSync(
    Effect.try(() => window.localStorage.getItem(SESSION_USER_KEY)).pipe(
      Effect.map((text) =>
        Option.getOrNull(
          Option.flatMap(
            Option.fromNullOr(text),
            Schema.decodeOption(Schema.fromJsonString(SessionUser))
          )
        )
      ),
      Effect.orElseSucceed(() => null)
    )
  );

/**
 * The account of the page's session: Convex Auth's access token names only the
 * session, and the answers of a sign-in or a refresh name the account. One store
 * for the page, which starts from the account the browser stored.
 */
export const sessionUser = createStore<{
  readonly user: typeof SessionUser.Type | null;
}>(() => ({ user: loadSessionUser() }));

/** Keeps the account an answer named, for this page and the next one. */
export function rememberSessionUser(accessToken: string, userId: string) {
  const sessionId = Option.getOrNull(
    Option.map(readTokenClaims(accessToken), ({ sub }) => sub)
  );
  if (sessionId === null) {
    return;
  }
  const user = SessionUser.make({ sessionId, userId });
  sessionUser.setState({ user });
  Effect.runSync(
    Schema.encodeEffect(Schema.fromJsonString(SessionUser))(user).pipe(
      Effect.flatMap((text) =>
        Effect.try(() => window.localStorage.setItem(SESSION_USER_KEY, text))
      ),
      Effect.ignore
    )
  );
}
