import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  type MaterialSourceCandidate,
  readPublishedMaterialClaims,
} from "@/lib/content/material/ownership";
import { readMaterialSource } from "@/lib/content/material/shell";

interface SourceSitemapRow {
  readonly kind: string;
  readonly section: string;
  readonly sourceParentPath?: string;
  readonly sourcePath: string;
}

/** Reconciles source material rows with exact active ownership. */
export const filterMaterialContentRows = Effect.fn(
  "www.sitemap.filterMaterialContentRows"
)(function* <Row extends SourceSitemapRow>(
  locale: Locale,
  rows: readonly Row[]
) {
  const candidates = rows.flatMap((row) =>
    row.section === "material" && row.kind === "curriculum-lesson"
      ? [
          {
            contentKey: row.sourcePath,
            locale,
            parentPath: row.sourceParentPath,
          } satisfies MaterialSourceCandidate,
        ]
      : []
  );
  const claims = yield* readPublishedMaterialClaims(locale, candidates);
  const claimed = new Set(
    claims.map((claim) => `${claim.locale}\0${claim.contentKey}`)
  );
  return rows.filter(
    (row) =>
      row.section !== "material" || !claimed.has(`${locale}\0${row.sourcePath}`)
  );
});

/** Reconciles source public paths with exact active ownership. */
export const filterMaterialPublicPaths = Effect.fn(
  "www.sitemap.filterMaterialPublicPaths"
)(function* (locale: Locale, paths: readonly string[]) {
  const sourceRoutes = paths.map((path) => readMaterialSource(locale, path));
  const candidates = new Map<string, MaterialSourceCandidate>();
  for (const source of sourceRoutes) {
    for (const candidate of source.candidates) {
      candidates.set(`${candidate.locale}\0${candidate.contentKey}`, candidate);
    }
  }
  const claims = yield* readPublishedMaterialClaims(
    locale,
    Array.from(candidates.values())
  );
  const claimed = new Set(
    claims.map((claim) => `${claim.locale}\0${claim.contentKey}`)
  );
  return paths.filter((_, index) => {
    const route = sourceRoutes[index]?.route;
    return !(route && claimed.has(`${route.locale}\0${route.sourcePath}`));
  });
});
