import "@tanstack/react-start/server-only";

import type { PageKey } from "@nakafa/aksara-contracts/projection/page";
import {
  PageKeySchema,
  PageMetadataSchema,
} from "@nakafa/aksara-contracts/projection/page";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { hasPreviewConfig } from "@/lib/content/preview/config";

const PageNavigationItemSchema = Schema.Struct({
  href: Schema.String,
  pageKey: PageKeySchema,
  title: PageMetadataSchema.fields.title,
});
/** One signed Page projected into the shared site navigation contract. */
type PageNavigationItem = typeof PageNavigationItemSchema.Type;

const PageNavigationSchema = Schema.Struct({
  developerItem: PageNavigationItemSchema,
  legalItems: Schema.Array(PageNavigationItemSchema),
  privacyPolicyHref: Schema.String,
  termsOfServiceHref: Schema.String,
});
/**
 * Verified developer and legal destinations for one locale. The router matches
 * each of them from its own route tree. Their links never preload: the route's
 * loader reads the signed Page through a server function, and a preload on hover
 * would run that read before the reader chooses the link.
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
  const item = Arr.findFirst(
    items,
    (candidate) => candidate.pageKey === pageKey
  );
  if (Option.isNone(item)) {
    return yield* new PageNavigationMissingError({ locale, pageKey });
  }
  return item.value;
});

/** Reads every published Page owned by one application locale. */
export const readPageNavigation = Effect.fn("www.pages.readNavigation")(
  function* (locale: Locale) {
    const catalog = yield* readPublishedPageCatalog();
    const localeItems = Arr.map(
      Arr.filter(catalog.projections, ({ appLocale }) => appLocale === locale),
      ({ metadata, pageKey, publicPath }): PageNavigationItem => ({
        href: `/${publicPath}`,
        pageKey,
        title: metadata.title,
      })
    );
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

/**
 * Reads the complete Page navigation. The catalog comes from the content store
 * for the active release.
 */
async function getPageNavigation(locale: Locale) {
  const navigation = await Effect.runPromise(
    readPageNavigation(locale).pipe(Effect.withTracerTiming(false))
  );
  return navigation;
}

/** Keeps isolated document previews independent from a complete publication. */
export function getShellPageNavigation(locale: Locale) {
  if (hasPreviewConfig()) {
    return Promise.resolve<PageNavigation | null>(null);
  }

  return getPageNavigation(locale);
}
