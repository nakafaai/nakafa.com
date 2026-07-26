import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { readMaterialPartition } from "@repo/backend/convex/contentRelease/material/partition";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { Effect } from "effect";

const MATERIAL_DISCOVERY_LIMIT = 100;

/** Selects the compact fields used by RSS, sitemap, and LLMS discovery. */
function summarizeMaterial(
  verified: Effect.Effect.Success<ReturnType<typeof verifyMaterial>>
) {
  const { projection } = verified;
  return {
    authors: projection.metadata.authors.map(({ name }) => ({ name })),
    date: projection.metadata.date,
    description: projection.metadata.description,
    publicPath: projection.publicPath,
    title: projection.metadata.title,
  };
}

/** Validates one bounded material discovery read. */
const validateDiscoveryLimit = Effect.fn(
  "contentRelease.validateMaterialDiscoveryLimit"
)(function* (limit: number) {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MATERIAL_DISCOVERY_LIMIT
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material discovery accepts 1 to ${MATERIAL_DISCOVERY_LIMIT} rows.`
    );
  }
});

/** Reads one complete hash partition for a managed material catalog. */
export const readMaterialBucket = Effect.fn(
  "contentRelease.readMaterialBucket"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof loadMaterialOwner>[1],
  bucket: string
) {
  const partition = yield* readMaterialPartition(ctx, locale, bucket);
  if (partition.kind === "unmanaged") {
    return { managed: false, materials: null };
  }
  if (partition.kind === "missing") {
    return { managed: true, materials: null };
  }
  return {
    managed: true,
    materials: partition.materials.map(summarizeMaterial),
  };
});

/** Reads a bounded newest-first material set from the active owner. */
export const readLatestMaterials = Effect.fn(
  "contentRelease.readLatestMaterials"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof loadMaterialOwner>[1],
  limit: number
) {
  yield* validateDiscoveryLimit(limit);
  const owner = yield* loadMaterialOwner(ctx, locale);
  if (!(owner.managed && owner.active)) {
    return { managed: false, materials: [] };
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_locale_and_date_and_contentKey", (index) =>
        index.eq("locale", locale)
      )
      .order("desc")
      .take(limit)
  );
  const verified = yield* Effect.forEach(rows, verifyMaterial);
  return {
    managed: true,
    materials: verified.map(summarizeMaterial),
  };
});
