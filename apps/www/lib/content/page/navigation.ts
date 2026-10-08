import "server-only";

import type { PageKey } from "@nakafa/aksara-contracts/projection/page";
import {
  PageKeySchema,
  PageMetadataSchema,
} from "@nakafa/aksara-contracts/projection/page";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyContentCache } from "@/lib/content/cache";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { hasPreviewConfig } from "@/lib/content/preview/config";

const PageNavigationItemSchema = Schema.Struct({
  href: Schema.String,
  pageKey: PageKeySchema,
  title: PageMetadataSchema.fields.title,
});
/** One signed Page projected into the shared site navigation contract. */
export type PageNavigationItem = typeof PageNavigationItemSchema.Type;

const PageNavigationSchema = Schema.Struct({
  developerItem: PageNavigationItemSchema,
  legalItems: Schema.Array(PageNavigationItemSchema),
  privacyPolicyHref: Schema.String,
  termsOfServiceHref: Schema.String,
});
/**
 * Verified developer and legal destinations for one locale.
 *
 * Links to these destinations never prefetch. Every signed Page shares the
 * root `[...page]` route, and the client router learns that route from the
 * first Page it fetches. Its optimistic routing then reads each lesson and
 * curriculum URL that next-intl rewrites, such as `/en/subjects/...` for
 * `/[locale]/materials/...`, as a Page. A prefetch teaches the router at
 * hydration, before any lesson link is scheduled, so each lesson prefetch that
 * follows is predicted as a Page and loads nothing, and opening a lesson shows
 * the marketing layout until the server corrects the route. Opening a Page by
 * navigation teaches the same route later, and Next.js then corrects it on the
 * first runtime prefetch whose route the server contradicts.
 *
 * https://github.com/vercel/next.js/blob/v16.4.0/packages/next/src/client/components/segment-cache/optimistic-routes.ts
 */
export type PageNavigation = typeof PageNavigationSchema.Type;

/** Raised when a required Page is absent from an active publication. */
export class PageNavigationMissingError extends Schema.TaggedError<PageNavigationMissingError>()(
  "PageNavigationMissingError",
  {
    locale: Schema.String,
    pageKey: PageKeySchema,
  }
) {}

const developerKey = PageKeySchema.make("developers");
const imprintKey = PageKeySchema.make("imprint");
const privacyPolicyKey = PageKeySchema.make("privacy-policy");
const securityPolicyKey = PageKeySchema.make("security-policy");
const termsOfServiceKey = PageKeySchema.make("terms-of-service");

/** Resolves one required stable Page identity without owning its public path. */
const readRequiredPageItem = Effect.fn("www.pages.readRequiredItem")(function* (
  items: readonly PageNavigationItem[],
  pageKey: PageKey,
  locale: Locale
) {
  const item = items.find((candidate) => candidate.pageKey === pageKey);
  if (!item) {
    return yield* new PageNavigationMissingError({ locale, pageKey });
  }
  return item;
});

/** Reads every published Page owned by one application locale. */
export const readPageNavigation = Effect.fn("www.pages.readNavigation")(
  function* (locale: Locale) {
    const catalog = yield* readPublishedPageCatalog();
    const localeItems: PageNavigationItem[] = [];
    for (const {
      appLocale,
      metadata,
      pageKey,
      publicPath,
    } of catalog.projections) {
      if (appLocale !== locale) {
        continue;
      }
      localeItems.push({
        href: `/${publicPath}`,
        pageKey,
        title: metadata.title,
      });
    }
    const [
      developerItem,
      imprintItem,
      privacyPolicyItem,
      securityPolicyItem,
      termsOfServiceItem,
    ] = yield* Effect.all([
      readRequiredPageItem(localeItems, developerKey, locale),
      readRequiredPageItem(localeItems, imprintKey, locale),
      readRequiredPageItem(localeItems, privacyPolicyKey, locale),
      readRequiredPageItem(localeItems, securityPolicyKey, locale),
      readRequiredPageItem(localeItems, termsOfServiceKey, locale),
    ]);
    return {
      developerItem,
      legalItems: [
        imprintItem,
        privacyPolicyItem,
        securityPolicyItem,
        termsOfServiceItem,
      ],
      privacyPolicyHref: privacyPolicyItem.href,
      termsOfServiceHref: termsOfServiceItem.href,
    } satisfies PageNavigation;
  }
);

/** Caches complete Page navigation under the exact signed family owner. */
export async function getPageNavigation(locale: Locale) {
  "use cache";

  const navigation = await Effect.runPromise(
    readPageNavigation(locale).pipe(Effect.withTracerTiming(false))
  );
  applyContentCache("page");
  return navigation;
}

/** Keeps isolated document previews independent from a complete publication. */
export function getShellPageNavigation(locale: Locale) {
  if (hasPreviewConfig()) {
    return Promise.resolve<PageNavigation | null>(null);
  }

  return getPageNavigation(locale);
}
