import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { hasCandidateLocalePreview } from "./environment";
import { loadLocaleMessages } from "./messages";
import { previewRouting } from "./routing";

/** Accepts inactive contract locales only for the authenticated local child. */
function hasRequestLocale(locale: string | undefined): locale is AppLocaleCode {
  if (hasLocale(routing.locales, locale)) {
    return true;
  }

  return (
    hasCandidateLocalePreview() && hasLocale(previewRouting.locales, locale)
  );
}

/**
 * Resolves the request locale for `next-intl` from `next/root-params` so the
 * app can use Cache Components without threading `locale` through every cached
 * subtree.
 *
 * References:
 * - next-intl Root Params adoption guide:
 *   https://next-intl.dev/blog/nextjs-root-params
 * - Next.js Root Params API:
 *   https://nextjs.org/docs/app/api-reference/functions/next-root-params
 * - Installed runtime path used by `getTranslations`:
 *   `apps/www/node_modules/next-intl/dist/esm/production/server/react-server/getConfig.js`
 */
export default getRequestConfig(async ({ locale }) => {
  if (hasRequestLocale(locale)) {
    const messages = await loadLocaleMessages(locale);

    return {
      locale,
      messages,
    };
  }

  const rootLocale = await rootParams.locale();

  if (!hasRequestLocale(rootLocale)) {
    notFound();
  }

  const messages = await loadLocaleMessages(rootLocale);

  return {
    locale: rootLocale,
    messages,
  };
});
