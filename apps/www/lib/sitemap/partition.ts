import type { Locale } from "next-intl";
import {
  formatArticlePartition,
  formatMaterialPartition,
  formatProgramPartition,
  type SitemapFamily,
  type SitemapPage,
} from "@/lib/sitemap/identity";

/** Buckets grouped into one capacity-owned sitemap document.
 *
 * Live hash buckets carry about one URL each, so bucket groups approximate
 * URL capacity while staying deterministic without loading route rows. The
 * grouping keeps a cold partition render to tens of parallel bucket reads.
 * Revisit URL-aware chunking once per-bucket counts reach www readers. */
export const SITEMAP_PARTITION_BUCKETS = 32;

/** Groups deterministic bucket ids into stable capacity-owned partitions. */
export function groupSitemapBuckets(buckets: readonly string[]): string[][] {
  const ordered = [...buckets].sort();
  const groups: string[][] = [];
  for (
    let index = 0;
    index < ordered.length;
    index += SITEMAP_PARTITION_BUCKETS
  ) {
    groups.push(ordered.slice(index, index + SITEMAP_PARTITION_BUCKETS));
  }
  return groups;
}

/** Describes capacity-owned sitemap partitions for one bucket inventory. */
export function describeSitemapPartitions(
  family: SitemapFamily,
  locale: Locale,
  buckets: readonly string[]
): SitemapPage[] {
  return groupSitemapBuckets(buckets).map((_, partition) => {
    if (family === "article") {
      return {
        id: formatArticlePartition(locale, partition),
        kind: "article",
        locale,
        partition,
      } as const;
    }
    if (family === "material") {
      return {
        id: formatMaterialPartition(locale, partition),
        kind: "material",
        locale,
        partition,
      } as const;
    }
    return {
      id: formatProgramPartition(locale, partition),
      kind: "program",
      locale,
      partition,
    } as const;
  });
}

/** Selects the bucket group served by one capacity-owned partition. */
export function selectSitemapPartition(
  buckets: readonly string[],
  partition: number
): readonly string[] {
  return groupSitemapBuckets(buckets)[partition] ?? [];
}
