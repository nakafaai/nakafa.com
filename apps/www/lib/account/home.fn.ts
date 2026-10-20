import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import auth from "@repo/backend/confect/_generated/refs/auth";
import chats from "@repo/backend/confect/_generated/refs/chats";
import contents from "@repo/backend/confect/_generated/refs/contents";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Option, Schema } from "effect";
import { createTranslator } from "use-intl";
import {
  admitAccount,
  ChatInput,
  LocaleInput,
  messagesFor,
  readToken,
  redirectToAuth,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import { preloadConfectQuery } from "@/lib/data/preload.server";
import { serverHandler } from "@/lib/server/fn";

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
