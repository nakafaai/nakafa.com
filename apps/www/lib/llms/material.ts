import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  type MaterialSourceCandidate,
  readPublishedMaterialClaims,
} from "@/lib/content/material/ownership";
import type { RuntimeContentRoute } from "@/lib/content/runtime/routes";

/** Mixed route rows selected for one partial-ownership material index page. */
export interface MaterialLlmsSources {
  readonly projections: readonly MaterialLessonProjection[];
  readonly rows: readonly RuntimeContentRoute[];
}

/** Replaces source material rows claimed by the active exact owner. */
export const reconcileMaterialLlmsRows = Effect.fn(
  "www.llms.reconcileMaterialRows"
)(function* (locale: Locale, rows: readonly RuntimeContentRoute[]) {
  const candidates = new Map<string, MaterialSourceCandidate>();
  for (const row of rows) {
    if (row.kind !== "curriculum-lesson" || !row.markdown) {
      continue;
    }
    const candidate = {
      contentKey: row.sourcePath,
      locale,
      parentPath: row.sourceParentPath,
    };
    candidates.set(`${locale}\0${row.sourcePath}`, candidate);
  }
  const claims = yield* readPublishedMaterialClaims(
    locale,
    Array.from(candidates.values())
  );
  const claimed = new Map(
    claims.map((claim) => [`${claim.locale}\0${claim.contentKey}`, claim])
  );
  const projections = new Map<string, MaterialLessonProjection>();
  for (const claim of claims) {
    if (claim.kind === "found") {
      projections.set(
        `${claim.projection.locale}\0${claim.projection.contentKey}`,
        claim.projection
      );
    }
  }
  return {
    projections: Array.from(projections.values()),
    rows: rows.filter((row) => !claimed.has(`${locale}\0${row.sourcePath}`)),
  } satisfies MaterialLlmsSources;
});
