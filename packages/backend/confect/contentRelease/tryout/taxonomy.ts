import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { listTryoutSitemapPaths } from "@repo/backend/content/tryout/sitemap";
import { Array as Arr, Effect, MutableHashMap } from "effect";

/** Reads the countries and exams of the active try-out catalog in one locale, with the count of its pages. */
export const readTryoutTaxonomy = Effect.fn(
  "contentRelease.readTryoutTaxonomy"
)(function* (locale: AppLocaleCode) {
  const catalog = yield* loadTryoutCatalog(locale);
  const { rows } = catalog;
  const exams = MutableHashMap.empty<string, string>();
  for (const row of rows) {
    if (row.kind === "exam") {
      MutableHashMap.set(exams, row.examKey, row.title);
    }
  }
  return {
    countries: Arr.flatMap(rows, (row) =>
      row.kind === "country" ? [{ id: row.countryKey, label: row.title }] : []
    ),
    exams: Arr.map(Arr.fromIterable(exams), ([id, label]) => ({ id, label })),
    // The pages of the catalog, as its sitemap lists them.
    routeCount: (yield* listTryoutSitemapPaths(catalog)).length,
  };
});
