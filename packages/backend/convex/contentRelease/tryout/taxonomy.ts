import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Reads localized options and route counts from one verified Tryout catalog. */
export const readTryoutTaxonomy = Effect.fn(
  "contentRelease.readTryoutTaxonomy"
)(function* (ctx: QueryCtx, locale: AppLocaleCode) {
  const catalog = yield* loadTryoutCatalog(locale).pipe(
    Effect.provide(convexTryoutLayer(ctx))
  );
  const countries: Array<{ id: string; label: string }> = [];
  const exams = new Map<string, string>();

  for (const { row } of catalog.entries) {
    if (row.kind === "country") {
      countries.push({ id: row.countryKey, label: row.title });
    }
    if (row.kind === "exam") {
      exams.set(row.examKey, row.title);
    }
  }

  return {
    countries,
    exams: Array.from(exams, ([id, label]) => ({ id, label })),
    routeCount: catalog.routeCount,
  };
});
