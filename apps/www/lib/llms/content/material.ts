import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { readPublishedMaterialBuckets } from "@/lib/content/material/sitemap";

/** Bounded signed material inventory for LLMS indexes. */
const MaterialLlmsInventorySchema = Schema.Struct({
  activeReleaseId: ReleaseIdSchema,
  buckets: Schema.Array(Schema.String),
  pageCount: Schema.Finite,
  routeCount: Schema.Finite,
});
type MaterialLlmsInventory = typeof MaterialLlmsInventorySchema.Type;

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
