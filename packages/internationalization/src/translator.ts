import type { Locale } from "@repo/internationalization/src/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { createTranslator, type Messages } from "use-intl";

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
  });
}
