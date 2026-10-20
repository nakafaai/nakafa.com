import "@tanstack/react-start/server-only";

import type { Locale } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { getShellPageNavigation } from "@/lib/content/page/navigation";

/** The absolute privacy and terms addresses of one locale, or none when no signed page answers. */
export async function readAuthLegalLinks(locale: Locale) {
  const pages = await getShellPageNavigation(locale);
  if (!pages) {
    return null;
  }
  return {
    privacy: new URL(`/${locale}${pages.privacyPolicyHref}`, SITE_ORIGIN).href,
    terms: new URL(`/${locale}${pages.termsOfServiceHref}`, SITE_ORIGIN).href,
  };
}
