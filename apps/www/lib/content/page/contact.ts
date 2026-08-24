import "server-only";

import {
  type ActiveAppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { PageKeySchema } from "@nakafa/aksara-contracts/projection/page";
import { Effect, Schema } from "effect";
import { applyPublishedCatalogCache } from "@/lib/content/cache";
import {
  type PublishedPageCatalog,
  readPublishedPageCatalog,
} from "@/lib/content/page/catalog";
import type { PublishedPageInput } from "@/lib/content/page/published";

const CONTACT_PAGE_KEY = PageKeySchema.make("imprint");

/** Raised when the signed company-information page is absent for a locale. */
export class ContactPageMissingError extends Schema.TaggedError<ContactPageMissingError>()(
  "ContactPageMissingError",
  { locale: AppLocaleSchema }
) {}

/** Resolves the contact alias to its reviewed signed Page identity. */
const resolveContactPageInput = Effect.fn("www.pages.resolveContactInput")(
  function* (catalog: PublishedPageCatalog, locale: ActiveAppLocaleCode) {
    const projection = catalog.projections.find(
      (candidate) =>
        candidate.appLocale === locale && candidate.pageKey === CONTACT_PAGE_KEY
    );
    if (!projection) {
      return yield* new ContactPageMissingError({
        locale: AppLocaleSchema.make(locale),
      });
    }
    return {
      activeReleaseId: catalog.activeReleaseId,
      appLocale: projection.appLocale,
      publicPath: projection.publicPath,
    } satisfies PublishedPageInput;
  }
);

/** Reads the current contact target from the active signed Page catalog. */
export const readContactPageInput = Effect.fn("www.pages.readContactInput")(
  function* (locale: ActiveAppLocaleCode) {
    const catalog = yield* readPublishedPageCatalog();
    return yield* resolveContactPageInput(catalog, locale);
  }
);

/** Caches the contact target under the signed Page catalog owner. */
export async function getContactPageInput(locale: ActiveAppLocaleCode) {
  "use cache";

  const input = await Effect.runPromise(readContactPageInput(locale));
  applyPublishedCatalogCache("page");
  return input;
}
