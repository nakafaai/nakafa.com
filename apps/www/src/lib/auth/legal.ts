import type { Locale } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Option, Schema } from "effect";
import type { PageNavigation } from "@/lib/content/page/navigation";

/** The absolute legal addresses of the sign-in sentence and of a school's opening. */
export const AuthLegalLinksSchema = Schema.Struct({
  dataProcessing: Schema.String,
  privacy: Schema.String,
  terms: Schema.String,
});

export type AuthLegalLinks = typeof AuthLegalLinksSchema.Type;

/**
 * The absolute legal addresses of one locale on the main site, from that locale's
 * page navigation. None when no signed page answers, so the sign-in sentence shows
 * no links.
 */
export function authLegalLinks(
  locale: Locale,
  navigation: PageNavigation | null
): Option.Option<AuthLegalLinks> {
  return Option.map(Option.fromNullishOr(navigation), (page) => ({
    dataProcessing: new URL(
      `/${locale}/${page.dataProcessingPath}`,
      SITE_ORIGIN
    ).href,
    privacy: new URL(`/${locale}/${page.privacyPolicyPath}`, SITE_ORIGIN).href,
    terms: new URL(`/${locale}/${page.termsOfServicePath}`, SITE_ORIGIN).href,
  }));
}
