import type { Locale } from "@repo/internationalization/src/locale";
import { Effect } from "effect";
import { authLegalLinks } from "@/lib/auth/legal";
import { getShellPageNavigation } from "@/lib/content/page/navigation";

/**
 * The absolute privacy and terms addresses of one locale on the main site. None
 * when no signed page answers, so the sign-in sentence shows no links.
 */
export const readAuthLegalLinks = Effect.fn("www.auth.legalLinks")(function* (
  locale: Locale
) {
  return authLegalLinks(locale, yield* getShellPageNavigation(locale));
});
