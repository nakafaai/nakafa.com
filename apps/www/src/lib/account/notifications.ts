import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { Locale } from "@repo/internationalization/src/locale";
import { Clock, Effect, Option } from "effect";
import { createTranslator } from "use-intl/core";
import {
  readAccountOptional,
  resolveAccountClient,
} from "@/lib/account/client";
import type { ScreenSeo } from "@/lib/account/head";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/**
 * Reads the signed-in notifications inbox directly in the browser (ADR 0038 D2):
 * the first page of the personal inbox, the read clock, and the head metadata
 * go out in one parallel batch over the browser's Convex client with no Worker
 * server function.
 */
export const readNotificationsScreen = Effect.fn("www.notifications.read")(
  function* (locale: Locale) {
    const clientOption = yield* resolveAccountClient();
    if (Option.isNone(clientOption)) {
      return { _tag: "SignedOut" as const };
    }
    const client = clientOption.value;
    const [first, messages, now] = yield* Effect.all(
      [
        readAccountOptional(
          client,
          notifications.inbox.list,
          {
            paginationOpts: { cursor: null, numItems: INBOX_PAGE_SIZE },
            personal: true,
          },
          "notifications.readOptional"
        ),
        Effect.promise(() =>
          readRenderedRouteMessages({
            locale,
            namespaces: ["Common", "Metadata"],
          })
        ),
        Clock.currentTimeMillis,
      ],
      { concurrency: "unbounded" }
    );
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
    return {
      _tag: "Ready" as const,
      screen: { first, now, seo },
    };
  }
);
