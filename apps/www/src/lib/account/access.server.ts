import auth from "@repo/backend/confect/_generated/refs/auth";
import users from "@repo/backend/confect/_generated/refs/users";
import type { Locale } from "@repo/internationalization/src/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { notFound, redirect } from "@tanstack/react-router";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { Effect, Option, String as Str } from "effect";
import { readSessionMemo } from "@/lib/auth/session.server";
import { readOptional, readRequired } from "@/lib/data/read.server";
import { serverHandler } from "@/lib/server/fn";
import type { ServerServices } from "@/lib/server/runtime";

/** The Convex token of this request, or undefined for a visitor, which makes no network call. */
export const readToken = Effect.fn("www.account.token")(function* () {
  const readSession = yield* readSessionMemo(getRequest());
  const session = yield* readSession;
  return Option.getOrUndefined(session.convexToken);
});

/** Ends the request with a 307 to sign-in, the answer of the reference's `admitAccountRoute`. */
export const redirectToAuth = Effect.fn("www.account.redirect")(function* (
  locale: Locale
) {
  return yield* Effect.die(
    redirect({ to: "/$locale/auth", params: { locale }, statusCode: 307 })
  );
});

/**
 * Runs an account server function on the runtime. The response is private before
 * the effect runs, so no cache keeps one visitor's data. A redirect or not-found
 * defect of the effect reaches the router unchanged.
 */
export function accountHandler<Data, A, E>(
  run: (data: Data) => Effect.Effect<A, E, ServerServices>
) {
  return serverHandler((data: Data) =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        setResponseHeader("cache-control", "private, no-store")
      );
      return yield* run(data);
    })
  );
}

/** Admits a signed-in visitor to an account screen and returns their token. */
export const admitAccount = Effect.fn("www.account.admit")(function* (
  locale: Locale
) {
  const token = yield* readToken();
  if (token === undefined) {
    return yield* redirectToAuth(locale);
  }
  return token;
});

/** The messages of one locale, read on the server only. */
export const messagesFor = Effect.fn("www.account.messages")(function* (
  locale: Locale
) {
  return yield* Effect.promise(() => loadLocaleMessages(locale));
});

/** Reads a profile by its username, and ends the request as not found when nobody holds it. */
export const readProfileOrNotFound = Effect.fn("www.account.profile")(
  function* (username: string, token: string | undefined) {
    const [profile, account] = yield* Effect.all(
      [
        readRequired(
          users.queries.getProfileByUsername,
          { username: Str.toLowerCase(username) },
          undefined
        ),
        token === undefined
          ? Effect.succeedNone
          : readOptional(auth.queries.getCurrentUser, {}, token).pipe(
              Effect.map(Option.fromNullishOr)
            ),
      ],
      { concurrency: "unbounded" }
    );
    const found = Option.fromNullishOr(profile);
    if (Option.isNone(found)) {
      return yield* Effect.die(notFound());
    }
    return {
      isOwner:
        Option.isSome(account) && account.value.appUser._id === found.value._id,
      profile: found.value,
    };
  }
);
