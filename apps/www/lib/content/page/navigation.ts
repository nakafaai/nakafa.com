import "server-only";

import type {
  PageKey,
  PageMetadata,
} from "@nakafa/aksara-contracts/projection/page";
import { PageKeySchema } from "@nakafa/aksara-contracts/projection/page";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyPublishedCatalogCache } from "@/lib/content/cache";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { hasPreviewConfig } from "@/lib/content/preview/config";

/** One signed Page projected into the shared site navigation contract. */
export interface PageNavigationItem {
  readonly href: string;
  readonly pageKey: PageKey;
  readonly title: PageMetadata["title"];
}

/** Verified developer and legal destinations for one locale. */
export interface PageNavigation {
  readonly developerItem: PageNavigationItem;
  readonly legalItems: readonly PageNavigationItem[];
  readonly privacyPolicyHref: string;
  readonly termsOfServiceHref: string;
}

/** Raised when a required Page is absent from an active publication. */
export class PageNavigationMissingError extends Schema.TaggedError<PageNavigationMissingError>()(
  "PageNavigationMissingError",
  {
    locale: Schema.String,
    pageKey: PageKeySchema,
  }
) {}

const developerKey = PageKeySchema.make("developers");
const privacyPolicyKey = PageKeySchema.make("privacy-policy");
const termsOfServiceKey = PageKeySchema.make("terms-of-service");
const legalPageKeys: ReadonlySet<PageKey> = new Set([
  PageKeySchema.make("imprint"),
  privacyPolicyKey,
  PageKeySchema.make("security-policy"),
  termsOfServiceKey,
]);

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
    const [developerItem, privacyPolicyItem, termsOfServiceItem] =
      yield* Effect.all([
        readRequiredPageItem(localeItems, developerKey, locale),
        readRequiredPageItem(localeItems, privacyPolicyKey, locale),
        readRequiredPageItem(localeItems, termsOfServiceKey, locale),
      ]);
    const legalItems = localeItems.filter(({ pageKey }) =>
      legalPageKeys.has(pageKey)
    );
    return {
      developerItem,
      legalItems,
      privacyPolicyHref: privacyPolicyItem.href,
      termsOfServiceHref: termsOfServiceItem.href,
    } satisfies PageNavigation;
  }
);

/** Caches complete Page navigation under the exact signed family owner. */
export async function getPageNavigation(locale: Locale) {
  "use cache";

  const navigation = await Effect.runPromise(readPageNavigation(locale));
  applyPublishedCatalogCache("page");
  return navigation;
}

/** Keeps isolated document previews independent from a complete publication. */
export function getShellPageNavigation(locale: Locale) {
  if (hasPreviewConfig()) {
    return Promise.resolve<PageNavigation | null>(null);
  }

  return getPageNavigation(locale);
}
