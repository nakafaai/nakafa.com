import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import type { MaterialReleasePin } from "@/lib/content/material/release";
import { readPublishedMaterialBuckets } from "@/lib/content/material/sitemap";
import { getRuntimeContentRouteCounts } from "@/lib/content/runtime/routes";

/** Bounded material LLMS inventory across source and published page owners. */
export interface MaterialLlmsInventory {
  readonly activeReleaseId: MaterialReleasePin;
  readonly buckets: readonly string[];
  readonly owner: "mixed" | "published" | "source";
  readonly pageCount: number;
  readonly publishedRouteCount: number;
  readonly sourcePageCount: number;
  readonly sourceRouteCount: number;
}

/** Reads one truthful bounded page inventory for material LLMS indexes. */
export const readMaterialLlmsInventory = Effect.fn(
  "www.llms.readMaterialInventory"
)(function* (locale: Locale) {
  const published = yield* readPublishedMaterialBuckets(locale);
  if (published.managed) {
    return {
      activeReleaseId: published.activeReleaseId,
      buckets: published.buckets,
      owner: "published",
      pageCount: published.buckets.length,
      publishedRouteCount: published.materialCount,
      sourcePageCount: 0,
      sourceRouteCount: 0,
    } satisfies MaterialLlmsInventory;
  }

  const counts = yield* getRuntimeContentRouteCounts({ locale });
  const sourceRouteCount =
    counts.find(({ section }) => section === "material")?.count ?? 0;
  const sourcePageCount = Math.ceil(
    sourceRouteCount / CONTENT_ROUTE_ARTIFACT_PAGE_SIZE
  );
  return {
    activeReleaseId: published.activeReleaseId,
    buckets: published.buckets,
    owner: published.buckets.length > 0 ? "mixed" : "source",
    pageCount: sourcePageCount + published.buckets.length,
    publishedRouteCount: published.materialCount,
    sourcePageCount,
    sourceRouteCount,
  } satisfies MaterialLlmsInventory;
});
