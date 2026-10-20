import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Schema } from "effect";

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
