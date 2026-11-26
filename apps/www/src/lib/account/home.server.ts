import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import chats from "@repo/backend/confect/_generated/refs/chats";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { notFound } from "@tanstack/react-router";
import { Clock, Effect, Schema } from "effect";
import { createTranslator } from "use-intl/core";
import {
  accountHandler,
  admitAccount,
  messagesFor,
  readToken,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { ChatInput, LocaleInput } from "@/lib/account/input";
import { readOptional } from "@/lib/data/read.server";

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
 * title that cannot be read is logged and left out, so the page still opens, and
 * an address that names no chat is not found.
 */
export const chatScreenHandler = accountHandler(
  ({ id }: typeof ChatInput.Type) =>
    Effect.gen(function* () {
      const token = yield* readToken();
      const chat = yield* readOptional(
        chats.queries.getChatTitle,
        { chatId: id },
        token
      );
      if (chat === null) {
        return yield* Effect.die(notFound());
      }
      const chatId = yield* Schema.decodeUnknownEffect(IdSchema("chats"))(
        id
      ).pipe(Effect.orDie);
      return { chatId, title: chat?.title ?? undefined };
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
        {
          paginationOpts: { cursor: null, numItems: INBOX_PAGE_SIZE },
          personal: true,
        },
        token
      );
      const now = yield* Clock.currentTimeMillis;
      const messages = yield* messagesFor(locale);
      const tCommon = createTranslator({
        locale,
        messages,
        namespace: "Common",
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
        title: tCommon("notifications"),
      };
      return { first, now, seo };
    })
);
