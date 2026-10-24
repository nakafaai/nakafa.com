import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import auth from "@repo/backend/confect/_generated/refs/auth";
import chats from "@repo/backend/confect/_generated/refs/chats";
import contents from "@repo/backend/confect/_generated/refs/contents";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import { redirect } from "@tanstack/react-router";
import { Clock, Effect, Option, Schema } from "effect";
import { createTranslator } from "use-intl";
import { getMaterialLooks } from "@/components/home/look";
import {
  accountHandler,
  admitAccount,
  messagesFor,
  readToken,
  redirectToAuth,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { ChatInput, LocaleInput } from "@/lib/account/input";
import { readHomeTrendingSubjects } from "@/lib/content/trending";
import { readOptional, readRequired } from "@/lib/data/read.server";

/** Home: the onboarding gate, the account name and the recently viewed subjects. */
export const homeScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const status = yield* readRequired(
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
            params: { locale },
            to: "/$locale/onboarding",
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
          readOptional(auth.queries.getCurrentUser, {}, token),
          readOptional(
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
      // The icon families stay on the server: each list passes only the looks it shows.
      const trending = yield* readHomeTrendingSubjects(locale);
      const recentLooks = getMaterialLooks(recentRows ?? []);
      return {
        name: Option.getOrUndefined(
          Option.map(
            Option.fromNullishOr(account),
            (user) => user.authUser.name
          )
        ),
        recentLooks,
        recentRows: recentRows ?? [],
        seo,
        trending,
        trendingLooks: getMaterialLooks(trending, recentLooks),
      };
    })
);

/** The new chat page: its localized title and description. */
export const chatIndexScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
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
);

/**
 * The chat sidebar that every chat page shows: the first page of the study chats
 * of the signed-in visitor. A visitor holds no chats, so the page reads none.
 */
export const chatSidebarScreenHandler = accountHandler(() =>
  Effect.gen(function* () {
    const token = yield* readToken();
    if (token === undefined) {
      return { first: undefined };
    }
    const first = yield* readOptional(
      chats.queries.getOwnChats,
      {
        paginationOpts: { cursor: null, numItems: CHAT_LIST_PAGE_SIZE },
        type: "study",
      },
      token
    );
    return { first };
  })
);

/**
 * A saved chat: its decoded id and its title, when the visitor may read it. A
 * title that cannot be read is logged and left out, so the page still opens.
 */
export const chatScreenHandler = accountHandler(
  ({ id }: typeof ChatInput.Type) =>
    Effect.gen(function* () {
      const chatId = yield* Schema.decodeUnknownEffect(IdSchema("chats"))(
        id
      ).pipe(Effect.orDie);
      const token = yield* readToken();
      const title = yield* readOptional(
        chats.queries.getChatTitle,
        { chatId },
        token
      ).pipe(Effect.map(Option.fromNullishOr));
      return { chatId, title: Option.getOrUndefined(title) };
    })
);

/** Search: the visitor's name for the greeting, and the search page head. */
export const searchScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* readToken();
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Utils",
      });
      const account =
        token === undefined
          ? Option.none()
          : Option.fromNullishOr(
              yield* readOptional(auth.queries.getCurrentUser, {}, token)
            );
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}/search`,
        description: t("search-description"),
        indexable: true,
        locale,
        title: t("search-title"),
      };
      return {
        name: Option.getOrUndefined(
          Option.map(account, (user) => user.authUser.name)
        ),
        seo,
      };
    })
);

/**
 * Notifications: the first page of the inbox and the inbox title, with the robots
 * rule the reference sets (noindex).
 */
export const notificationsScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const first = yield* readOptional(
        notifications.inbox.list,
        { paginationOpts: { cursor: null, numItems: INBOX_PAGE_SIZE } },
        token
      );
      const now = yield* Clock.currentTimeMillis;
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
      return { first, now, seo };
    })
);
