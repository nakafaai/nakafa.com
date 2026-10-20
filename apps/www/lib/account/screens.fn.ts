import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import auth from "@repo/backend/confect/_generated/refs/auth";
import chats from "@repo/backend/confect/_generated/refs/chats";
import contents from "@repo/backend/confect/_generated/refs/contents";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import posts from "@repo/backend/confect/_generated/refs/posts";
import subscriptions from "@repo/backend/confect/_generated/refs/subscriptions";
import users from "@repo/backend/confect/_generated/refs/users";
import { products } from "@repo/backend/confect/customers/polar/products";
import {
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Clock, Effect, Option, Schema, String as Str } from "effect";
import { createTranslator } from "use-intl";
import { MEMORY_PAGE } from "@/components/user/settings/memory/list";
import type { ScreenSeo } from "@/lib/account/head";
import { readRequestSession } from "@/lib/auth/session.server";
import { preloadConfectQuery } from "@/lib/data/preload.server";
import { profileHref } from "@/lib/profile/href";
import { serverHandler } from "@/lib/server/fn";

/** The route input of a locale-scoped screen. */
const LocaleInput = Schema.Struct({ locale: LocaleSchema });

/** The route input of a screen under one profile: the locale and the username in the URL. */
const ProfileInput = Schema.Struct({
  locale: LocaleSchema,
  username: Schema.String,
});

/** The route input of a saved chat: the locale and the chat id in the URL. */
const ChatInput = Schema.Struct({ id: Schema.String, locale: LocaleSchema });

/** The Convex token of this request, or undefined for a visitor, which makes no network call. */
const readToken = Effect.fn("www.account.token")(function* () {
  const session = yield* readRequestSession(getRequest());
  return Option.getOrUndefined(session.convexToken);
});

/** Ends the request with a 307 to sign-in, the answer of the reference's `admitAccountRoute`. */
const redirectToAuth = (locale: Locale) =>
  Effect.die(
    redirect({ to: "/$locale/auth", params: { locale }, statusCode: 307 })
  );

/** Admits a signed-in visitor to an account screen and returns their token. */
const admitAccount = Effect.fn("www.account.admit")(function* (locale: Locale) {
  const token = yield* readToken();
  if (token === undefined) {
    return yield* redirectToAuth(locale);
  }
  return token;
});

/** The messages of one locale, read on the server only. */
const messagesFor = Effect.fn("www.account.messages")(function* (
  locale: Locale
) {
  return yield* Effect.promise(() => loadLocaleMessages(locale));
});

/** Reads a profile by its username, and ends the request as not found when nobody holds it. */
const readProfileOrNotFound = Effect.fn("www.account.profile")(function* (
  username: string,
  token: string | undefined
) {
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
});

/** Home: the onboarding gate, the account name and the recently viewed subjects. */
export const homeScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(
    serverHandler(({ locale }: typeof LocaleInput.Type) =>
      Effect.gen(function* () {
        const token = yield* admitAccount(locale);
        const status = yield* preloadConfectQuery(
          onboarding.queries.getStatus,
          {},
          token
        );
        if (!status.isAuthenticated) {
          return yield* redirectToAuth(locale);
        }
        if (status.isRequired) {
          return yield* Effect.die(
            redirect({
              to: "/$locale/onboarding",
              params: { locale },
              statusCode: 307,
            })
          );
        }
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Metadata",
        });
        const [account, recentRows] = yield* Effect.all(
          [
            preloadConfectQuery(auth.queries.getCurrentUser, {}, token),
            preloadConfectQuery(
              contents.queries.recent.getRecentlyViewed,
              { locale, limit: 5 },
              token
            ),
          ],
          { concurrency: "unbounded" }
        );
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}`,
          description: t("description"),
          indexable: true,
          locale,
          title: t("title"),
        };
        return { name: account?.authUser.name ?? null, recentRows, seo };
      })
    )
  );

/** The new chat page: its localized title and description. */
export const chatIndexScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(
    serverHandler(({ locale }: typeof LocaleInput.Type) =>
      Effect.gen(function* () {
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Ai",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}/chat`,
          description: t("new-chat-description"),
          indexable: true,
          locale,
          title: t("new-chat-title"),
        };
        return { seo };
      })
    )
  );

/** A saved chat: its decoded id and its title, when the visitor may read it. */
export const chatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ChatInput))
  .handler(
    serverHandler(({ id }: typeof ChatInput.Type) =>
      Effect.gen(function* () {
        const chatId = yield* Schema.decodeUnknownEffect(IdSchema("chats"))(
          id
        ).pipe(Effect.orDie);
        const token = yield* readToken();
        const title = yield* preloadConfectQuery(
          chats.queries.getChatTitle,
          { chatId },
          token
        ).pipe(Effect.option);
        return { chatId, title: Option.getOrNull(title) };
      })
    )
  );

/** Search: the visitor's name for the greeting, and the search page head. */
export const searchScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(
    serverHandler(({ locale }: typeof LocaleInput.Type) =>
      Effect.gen(function* () {
        const token = yield* readToken();
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Utils",
        });
        const account =
          token === undefined
            ? null
            : yield* preloadConfectQuery(
                auth.queries.getCurrentUser,
                {},
                token
              );
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}/search`,
          description: t("search-description"),
          indexable: true,
          locale,
          title: t("search-title"),
        };
        return { name: account?.authUser.name ?? null, seo };
      })
    )
  );

/** Notifications: the inbox title, with the robots rule the reference sets (noindex). */
export const notificationsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(
    serverHandler(({ locale }: typeof LocaleInput.Type) =>
      Effect.gen(function* () {
        const messages = yield* messagesFor(locale);
        const t = createTranslator({
          locale,
          messages,
          namespace: "Notifications",
        });
        const meta = createTranslator({
          locale,
          messages,
          namespace: "Metadata",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}`,
          description: meta("description"),
          indexable: false,
          locale,
          title: t("title"),
        };
        return { seo };
      })
    )
  );

/** A profile: the profile, whether the visitor owns it, and the layout's head. */
export const profileScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(
    serverHandler(({ locale, username }: typeof ProfileInput.Type) =>
      Effect.gen(function* () {
        const token = yield* readToken();
        const { isOwner, profile } = yield* readProfileOrNotFound(
          username,
          token
        );
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Auth",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}`,
          description: t("profile-description"),
          indexable: false,
          locale,
          title: t("profile"),
        };
        return { isOwner, profile, seo };
      })
    )
  );

/** The first page of a profile's posts, with the moment the server read them. */
export const profilePostsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(
    serverHandler(({ username }: typeof ProfileInput.Type) =>
      Effect.gen(function* () {
        const token = yield* readToken();
        const { profile } = yield* readProfileOrNotFound(username, token);
        const [first, now] = yield* Effect.all(
          [
            preloadConfectQuery(
              posts.queries.list,
              {
                authorId: profile._id,
                paginationOpts: { cursor: null, numItems: POST_PAGE_SIZE },
              },
              token
            ),
            Clock.currentTimeMillis,
          ],
          { concurrency: "unbounded" }
        );
        return { first, now };
      })
    )
  );

/** The chats of a profile: the owner's alone, so anyone else gets the not-found page. */
export const profileChatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(
    serverHandler(({ locale, username }: typeof ProfileInput.Type) =>
      Effect.gen(function* () {
        const token = yield* readToken();
        const { isOwner, profile } = yield* readProfileOrNotFound(
          username,
          token
        );
        if (!isOwner) {
          return yield* Effect.die(notFound());
        }
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Auth",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}/chat`,
          description: t("chat-description"),
          indexable: false,
          locale,
          title: t("chat"),
        };
        return { seo, userId: profile._id };
      })
    )
  );

/** The comments of a profile: the head and the profile's owner id. */
export const profileCommentsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(
    serverHandler(({ locale, username }: typeof ProfileInput.Type) =>
      Effect.gen(function* () {
        const token = yield* readToken();
        const { profile } = yield* readProfileOrNotFound(username, token);
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Auth",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}/comments`,
          description: t("profile-description"),
          indexable: false,
          locale,
          title: t("profile"),
        };
        return { seo, userId: profile._id };
      })
    )
  );

/** Settings: the account, or not found when the account is gone. */
export const settingsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(
    serverHandler(({ locale }: typeof LocaleInput.Type) =>
      Effect.gen(function* () {
        const token = yield* admitAccount(locale);
        const account = yield* preloadConfectQuery(
          auth.queries.getCurrentUser,
          {},
          token
        );
        if (account === null) {
          return yield* Effect.die(notFound());
        }
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Auth",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}`,
          description: t("settings-description"),
          indexable: false,
          locale,
          title: t("settings"),
        };
        return { account, seo };
      })
    )
  );

/** Learning settings: the account, the saved preference and the curriculum programs. */
export const learningScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(
    serverHandler(({ locale }: typeof LocaleInput.Type) =>
      Effect.gen(function* () {
        const token = yield* admitAccount(locale);
        const [account, preference, programs] = yield* Effect.all(
          [
            preloadConfectQuery(auth.queries.getCurrentUser, {}, token),
            preloadConfectQuery(
              learningPreferences.queries.getCurrent,
              { locale },
              token
            ),
            preloadConfectQuery(
              learningPreferences.queries.listCurriculumPrograms,
              { locale },
              token
            ),
          ],
          { concurrency: "unbounded" }
        );
        if (account === null) {
          return yield* Effect.die(notFound());
        }
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Auth",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}`,
          description: t("learning-description"),
          indexable: false,
          locale,
          title: t("learning"),
        };
        return { account, preference, programs, seo };
      })
    )
  );

/** Memory settings: the first page of memories, whether memory is paused and the moment of the read. */
export const memoryScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(
    serverHandler(({ locale }: typeof LocaleInput.Type) =>
      Effect.gen(function* () {
        const token = yield* admitAccount(locale);
        const [first, state, now] = yield* Effect.all(
          [
            preloadConfectQuery(
              nina.memory.list,
              { paginationOpts: { cursor: null, numItems: MEMORY_PAGE } },
              token
            ),
            preloadConfectQuery(nina.memory.state, {}, token),
            Clock.currentTimeMillis,
          ],
          { concurrency: "unbounded" }
        );
        if (state === null) {
          return yield* Effect.die(notFound());
        }
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Auth",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}`,
          description: t("memory-description"),
          indexable: false,
          locale,
          title: t("memory"),
        };
        return { first, now, paused: state.paused, seo };
      })
    )
  );

/** Subscriptions: whether the visitor holds the Pro subscription, and the page head. */
export const subscriptionsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(
    serverHandler(({ locale }: typeof LocaleInput.Type) =>
      Effect.gen(function* () {
        const token = yield* admitAccount(locale);
        const subscription = yield* preloadConfectQuery(
          subscriptions.queries.hasActiveSubscription,
          { productId: products.pro.id },
          token
        );
        const t = createTranslator({
          locale,
          messages: yield* messagesFor(locale),
          namespace: "Auth",
        });
        const seo: ScreenSeo = {
          canonicalPath: `/${locale}`,
          description: t("subscriptions-description"),
          indexable: false,
          locale,
          title: t("subscriptions"),
        };
        return { seo, subscription };
      })
    )
  );
