import "server-only";

import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { buildSiteLlmsEntries } from "@/lib/llms/entries";

/** Reads site entries from the active signed Page catalog. */
export const readSiteLlmsEntries = Effect.fn("www.llms.site.entries")(
  function* (locale: Locale) {
    const [catalog, messages] = yield* Effect.all([
      readPublishedPageCatalog(),
      Effect.promise(() => loadLocaleMessages(locale)),
    ]);
    return buildSiteLlmsEntries(locale, catalog.projections, [
      {
        description: messages.PricingPage["metadata-description"],
        route: "/pricing",
        title: messages.PricingPage.breadcrumb,
      },
    ]);
  }
);
