import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { Array as Arr, Effect, MutableHashMap } from "effect";

/** Reads the countries and exams of the active try-out catalog in one locale, with its public route count. */
export const readTryoutTaxonomy = Effect.fn(
  "contentRelease.readTryoutTaxonomy"
)(function* (locale: AppLocaleCode) {
  const { rows } = yield* loadTryoutCatalog(locale);
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
    routeCount: Arr.countBy(rows, ({ publicPath }) => publicPath !== undefined),
  };
});
