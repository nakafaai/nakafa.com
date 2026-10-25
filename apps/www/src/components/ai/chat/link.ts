import { shareTokenValidator } from "@repo/backend/confect/chats/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Locale } from "@repo/internationalization/src/locale";
import { getAppUrl } from "@repo/site/app";
import { Option, Schema, String as Str } from "effect";
import { SHARE_ENTRY } from "@/lib/share/fragment";

/**
 * The link a learner gives out for a shared chat, in the locale of the page that
 * shares it: the chat's route lives under the locale, so a link without one opens
 * no page. The token rides in the fragment, which a browser sends to no server, so
 * opening the link leaves it in no request log, and the analytics client drops
 * fragments from the URLs it reports. No flow that sends the address of the page on
 * carries it either (ADR 0001). The chat id alone opens nothing.
 */
export function shareLink(chatId: Id<"chats">, token: string, locale: Locale) {
  const link = new URL(`/${locale}/chat/${chatId}`, getAppUrl());
  link.hash = new URLSearchParams({ [SHARE_ENTRY]: token }).toString();
  return link.href;
}

/**
 * The share token that `hash`, the `location.hash` of a page, carries. It is
 * none when the fragment carries no token or one that cannot be a token, so
 * such a link is read by chat id, as its owner reads it.
 */
export function readShareToken(hash: string) {
  return Option.getOrUndefined(
    Schema.decodeUnknownOption(shareTokenValidator)(
      new URLSearchParams(Str.slice(1)(hash)).get(SHARE_ENTRY) ?? undefined
    )
  );
}
