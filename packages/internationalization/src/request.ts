import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "@repo/utilities/locales";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

const loadEnglishMessages = () =>
  import("@repo/internationalization/dictionaries/en.json");
type EnglishMessagesModule = Awaited<ReturnType<typeof loadEnglishMessages>>;

const loadMessagesByLocale = {
  en: loadEnglishMessages,
  id: () => import("@repo/internationalization/dictionaries/id.json"),
} satisfies Record<Locale, () => Promise<EnglishMessagesModule>>;

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
  if (hasLocale(routing.locales, locale)) {
    const messages = await loadMessagesByLocale[locale]();

    return {
      locale,
      messages: messages.default,
    };
  }

  const rootLocale = await rootParams.locale();

  if (!hasLocale(routing.locales, rootLocale)) {
    notFound();
  }

  const messages = await loadMessagesByLocale[rootLocale]();

  return {
    locale: rootLocale,
    messages: messages.default,
  };
});
