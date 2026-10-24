import type { Locale } from "@repo/internationalization/src/locale";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect, Option } from "effect";
import { getShellPageNavigation } from "@/lib/content/page/navigation";

/**
 * The absolute privacy and terms addresses of one locale on the main site. None
 * when no signed page answers, so the sign-in sentence shows no links.
 */
export const readAuthLegalLinks = Effect.fn("www.auth.legalLinks")(function* (
  locale: Locale
) {
  const pages = yield* getShellPageNavigation(locale);
  return Option.map(Option.fromNullishOr(pages), (page) => ({
    privacy: new URL(`/${locale}${page.privacyPolicyHref}`, SITE_ORIGIN).href,
    terms: new URL(`/${locale}${page.termsOfServiceHref}`, SITE_ORIGIN).href,
  }));
});

/**
 * The sign-in answer for the locale that the request names, or for the locale
 * that the request negotiates when it names none.
 */
export const readAuthLegalHandler = Effect.fn("www.auth.legalHandler")(
  function* (requested: Locale | undefined) {
    return yield* readAuthLegalLinks(
      requested ?? negotiateLocale(getRequestHeaders())
    );
  }
);
