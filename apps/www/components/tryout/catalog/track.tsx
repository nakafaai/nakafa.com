import { Effect } from "effect";
import type { Locale } from "next-intl";
import type { SearchParams } from "nuqs/server";
import { readTryoutSetList } from "@/components/tryout/catalog/server";
import { readCatalogQuery } from "@/components/tryout/catalog/table/query";
import { TryoutSetTable } from "@/components/tryout/catalog/table/table.client";
import {
  TRYOUT_SET_PAGE_SIZE,
  type TryoutTrackPage,
} from "@/components/tryout/catalog/table/types";
import { getToken } from "@/lib/auth/server";

/** Streams a request-authenticated first result without caching personal progress. */
export async function TryoutTrackTable({
  locale,
  page,
  searchParams,
}: {
  locale: Locale;
  page: TryoutTrackPage;
  searchParams: Promise<SearchParams>;
}) {
  const [token, search] = await Promise.all([getToken(), searchParams]);
  const selection = readCatalogQuery(search);
  const args = {
    countryKey: page.country.countryKey,
    examKey: page.exam.examKey,
    locale,
    trackKey: page.track.trackKey,
    filter: selection.status,
    sort: { field: selection.sort, direction: selection.direction },
    paginationOpts: { cursor: null, numItems: TRYOUT_SET_PAGE_SIZE },
  };
  // getToken reads request headers before this Effect runtime can access the clock.
  const result = await Effect.runPromise(readTryoutSetList(token, args));
  return (
    <TryoutSetTable
      bootstrap={{ args, result }}
      key={`${locale}:${page.track.publicPath}`}
      title={page.track.title}
    />
  );
}
