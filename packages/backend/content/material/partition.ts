import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyMaterial } from "@repo/backend/content/material/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_SITEMAP_BUCKET_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { Effect, Option } from "effect";

/** Reads a transaction-bounded group of complete material discovery buckets. */
export const readMaterialPartition = Effect.fn(
  "contentRelease.readMaterialPartition"
)(function* (
  appLocale: PublicationRow<"materialCatalog">["appLocale"],
  buckets: readonly string[]
) {
  if (
    buckets.length === 0 ||
    buckets.length > MATERIAL_SITEMAP_BUCKET_LIMIT ||
    new Set(buckets).size !== buckets.length ||
    buckets.some((bucket) => !isProjectionBucket(bucket))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material discovery requires 1 to ${MATERIAL_SITEMAP_BUCKET_LIMIT} distinct valid buckets.`
    );
  }
  const owner = yield* loadMaterialOwner(appLocale);
  const activeReleaseId = owner.active?.releaseId ?? null;
  if (!(owner.active && owner.managed && owner.slot)) {
    return {
      activeReleaseId,
      kind: "unmanaged",
    } satisfies {
      readonly activeReleaseId: typeof activeReleaseId;
      readonly kind: "unmanaged";
    };
  }
  const source = yield* MaterialSource;
  const materials: (Effect.Success<ReturnType<typeof verifyMaterial>> & {
    readonly row: PublicationRow<"materialCatalog">;
  })[] = [];
  for (const bucket of buckets) {
    const { count: selectedCount, materials: rows } = yield* source.partition(
      owner.slot,
      appLocale,
      bucket,
      CONTENT_BUCKET_SIZE + 1
    );
    const count = Option.getOrNull(selectedCount);
    if (!count) {
      if (buckets.length > 1) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Material discovery batch lost bucket ${appLocale}/${bucket}.`
        );
      }
      return { activeReleaseId, kind: "missing" as const };
    }

    if (
      rows.length !== count.count ||
      rows.length === 0 ||
      rows.length > CONTENT_BUCKET_SIZE
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material discovery bucket ${appLocale}/${bucket} has mismatched counts.`
      );
    }
    const verified = yield* Effect.forEach(rows, (row) =>
      verifyMaterial(row).pipe(Effect.map((material) => ({ ...material, row })))
    );
    materials.push(...verified);
  }
  return {
    activeReleaseId,
    kind: "found",
    materials,
  } satisfies {
    readonly activeReleaseId: typeof activeReleaseId;
    readonly kind: "found";
    readonly materials: typeof materials;
  };
});
