import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  type MaterialSourceCandidate,
  readPublishedMaterialClaims,
} from "@/lib/content/material/ownership";
import type { MaterialReleasePin } from "@/lib/content/material/release";
import type { RuntimeContentRoute } from "@/lib/content/runtime/routes";

/** Removes source material rows claimed by the active exact owner. */
export const reconcileMaterialLlmsRows = Effect.fn(
  "www.llms.reconcileMaterialRows"
)(function* (
  locale: Locale,
  rows: readonly RuntimeContentRoute[],
  expectedActiveReleaseId: MaterialReleasePin
) {
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
    Array.from(candidates.values()),
    expectedActiveReleaseId
  );
  const claimed = new Map(
    claims.map((claim) => [`${claim.locale}\0${claim.contentKey}`, claim])
  );
  return rows.filter((row) => !claimed.has(`${locale}\0${row.sourcePath}`));
});
