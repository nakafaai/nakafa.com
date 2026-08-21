import "server-only";

import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { buildSiteLlmsEntries } from "@/lib/llms/entries";

/** Reads site entries from the active signed Page catalog. */
export const readSiteLlmsEntries = Effect.fn("www.llms.site.entries")(
  function* (locale: Locale) {
    const catalog = yield* readPublishedPageCatalog();
    return buildSiteLlmsEntries(locale, catalog.projections);
  }
);
