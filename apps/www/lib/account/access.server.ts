import "@tanstack/react-start/server-only";
import auth from "@repo/backend/confect/_generated/refs/auth";
import users from "@repo/backend/confect/_generated/refs/users";
import {
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { notFound, redirect } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Option, Schema, String as Str } from "effect";
import { readRequestSession } from "@/lib/auth/session.server";
import { preloadConfectQuery } from "@/lib/data/preload.server";

/** The route input of a locale-scoped screen. */
export const LocaleInput = Schema.Struct({ locale: LocaleSchema });

/** The route input of a screen under one profile: the locale and the username in the URL. */
export const ProfileInput = Schema.Struct({
  locale: LocaleSchema,
  username: Schema.String,
});

/** The route input of a saved chat: the locale and the chat id in the URL. */
export const ChatInput = Schema.Struct({
  id: Schema.String,
  locale: LocaleSchema,
});

/** The Convex token of this request, or undefined for a visitor, which makes no network call. */
export const readToken = Effect.fn("www.account.token")(function* () {
  const session = yield* readRequestSession(getRequest());
  return Option.getOrUndefined(session.convexToken);
});

/** Ends the request with a 307 to sign-in, the answer of the reference's `admitAccountRoute`. */
export const redirectToAuth = (locale: Locale) =>
  Effect.die(
    redirect({ to: "/$locale/auth", params: { locale }, statusCode: 307 })
  );

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
        preloadConfectQuery(
          users.queries.getProfileByUsername,
          { username: Str.toLowerCase(username) },
          undefined
        ),
        token === undefined
          ? Effect.succeed(null)
          : preloadConfectQuery(auth.queries.getCurrentUser, {}, token),
      ],
      { concurrency: "unbounded" }
    );
    if (profile === null) {
      return yield* Effect.die(notFound());
    }
    return {
      isOwner: account !== null && account.appUser._id === profile._id,
      profile,
    };
  }
);
