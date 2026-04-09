import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Resolves the request locale for `next-intl` from `next/root-params` so the
 * app can use Cache Components without threading `locale` through every cached
 * subtree.
 *
 * References:
 * - Aurora Scharff, "Moving root params into i18n/request.ts":
 *   https://aurorascharff.no/posts/implementing-nextjs-16-use-cache-with-next-intl-internationalization/#moving-root-params-into-i18nrequestts
 * - Next.js 16.2 root params support inside cache scopes:
 *   https://github.com/vercel/next.js/pull/91191
 * - next-intl cacheComponents support thread:
 *   https://github.com/amannn/next-intl/issues/1493
 * - Installed runtime path used by `getTranslations`:
 *   `apps/www/node_modules/next-intl/dist/esm/production/server/react-server/getConfig.js`
 */
export default getRequestConfig(async ({ locale }) => {
  let resolvedLocale = locale;

  if (!resolvedLocale) {
    const paramValue = await rootParams.locale();

    if (hasLocale(routing.locales, paramValue)) {
      resolvedLocale = paramValue;
    } else {
      notFound();
    }
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`../dictionaries/${resolvedLocale}.json`)).default,
  };
});
