import {
  type Locale,
  localeTimeZone,
} from "@repo/internationalization/src/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { DateTime, Effect } from "effect";
import { createTranslator, type Messages } from "use-intl";

/**
 * The instant of the current request as a Date. use-intl formats relative times
 * from it, so every server render of one request reads the same clock.
 */
export async function readRequestNow() {
  return DateTime.toDateUtc(await Effect.runPromise(DateTime.now));
}

/**
 * The translator of one message namespace in one locale, for server code that
 * renders outside a provider: metadata, Open Graph images, feeds and the async
 * server components that read data. The locale is passed in, so the translator
 * never depends on the request. The dictionary loads at the Promise boundary,
 * so no client bundle carries the whole dictionary.
 */
export async function readServerTranslator<
  const Namespace extends keyof Messages & string,
>(input: { readonly locale: Locale; readonly namespace: Namespace }) {
  const messages: Messages = await loadLocaleMessages(input.locale);
  return createTranslator({
    locale: input.locale,
    messages,
    namespace: input.namespace,
    now: await readRequestNow(),
    timeZone: localeTimeZone(input.locale),
  });
}
