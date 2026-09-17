// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  describeSitemapPartitions,
  groupSitemapBuckets,
  SITEMAP_PARTITION_BUCKETS,
  selectSitemapPartition,
} from "@/lib/sitemap/partition";

describe("sitemap capacity partitions", () => {
  it("groups one bucket per partition while the corpus fits one group", () => {
    expect(groupSitemapBuckets(["b", "a", "c"])).toEqual([["a", "b", "c"]]);
    expect(groupSitemapBuckets([])).toEqual([]);
  });

  it("keeps grouping deterministic regardless of inventory order", () => {
    const forward = groupSitemapBuckets(["003", "001", "002"]);
    const backward = groupSitemapBuckets(["002", "003", "001"]);

    expect(forward).toEqual(backward);
    expect(forward).toEqual([["001", "002", "003"]]);
  });

  it("splits bucket inventories into stable capacity-owned groups", () => {
    const buckets = Array.from(
      { length: SITEMAP_PARTITION_BUCKETS + 2 },
      (_, index) => `b${String(index).padStart(3, "0")}`
    );

    const groups = groupSitemapBuckets(buckets);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(SITEMAP_PARTITION_BUCKETS);
    expect(groups[1]).toHaveLength(2);
    expect(selectSitemapPartition(buckets, 0)).toEqual(groups[0]);
    expect(selectSitemapPartition(buckets, 1)).toEqual(groups[1]);
    expect(selectSitemapPartition(buckets, 2)).toEqual([]);
  });

  it("describes stable partition ids per family and locale", () => {
    expect(describeSitemapPartitions("material", "en", ["def"])).toEqual([
      {
        id: "material_en_p0",
        kind: "material",
        locale: "en",
        partition: 0,
      },
    ]);
    expect(describeSitemapPartitions("article", "id", ["abc"])).toEqual([
      {
        id: "article_id_p0",
        kind: "article",
        locale: "id",
        partition: 0,
      },
    ]);
    expect(describeSitemapPartitions("program", "de", ["001", "002"])).toEqual([
      {
        id: "program_de_p0",
        kind: "program",
        locale: "de",
        partition: 0,
      },
    ]);
  });
});
