import type { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedMaterialBuckets } from "@/lib/content/material/sitemap";

/** Bounded signed material inventory for LLMS indexes. */
export interface MaterialLlmsInventory {
  readonly activeReleaseId: typeof ReleaseIdSchema.Type;
  readonly buckets: readonly string[];
  readonly pageCount: number;
  readonly routeCount: number;
}

/** Reads one truthful bounded page inventory from the signed catalog. */
export const readMaterialLlmsInventory = Effect.fn(
  "www.llms.readMaterialInventory"
)(function* (locale: Locale) {
  const published = yield* readPublishedMaterialBuckets(locale);
  return {
    activeReleaseId: published.activeReleaseId,
    buckets: published.buckets,
    pageCount: published.buckets.length,
    routeCount: published.materialCount,
  } satisfies MaterialLlmsInventory;
});
