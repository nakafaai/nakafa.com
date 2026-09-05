import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { readMaterialPartition } from "@repo/backend/content/material/partition";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyMaterial } from "@repo/backend/content/material/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

const MATERIAL_DISCOVERY_LIMIT = 100;
/** Selects the compact fields used by RSS, sitemap, and LLMS discovery. */
function summarizeMaterial(
  verified: Effect.Success<ReturnType<typeof verifyMaterial>>,
  sourcePath: string
) {
  const { projection } = verified;
  return {
    authors: projection.metadata.authors.map(({ name }) => ({ name })),
    ...(projection.metadata.dateModified === undefined
      ? {}
      : { dateModified: projection.metadata.dateModified }),
    datePublished: projection.metadata.datePublished,
    description: projection.metadata.description,
    publicPath: projection.publicPath,
    sourcePath,
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
  appLocale: Parameters<typeof loadMaterialOwner>[0],
  bucket: string
) {
  const partition = yield* readMaterialPartition(appLocale, bucket);
  if (partition.kind === "unmanaged") {
    return {
      activeReleaseId: partition.activeReleaseId,
      managed: false,
      materials: null,
    };
  }
  if (partition.kind === "missing") {
    return {
      activeReleaseId: partition.activeReleaseId,
      managed: true,
      materials: null,
    };
  }
  return {
    activeReleaseId: partition.activeReleaseId,
    managed: true,
    materials: partition.materials.map((material) =>
      summarizeMaterial(material, material.row.sourcePath)
    ),
  };
});
/** Reads a bounded newest-first material set from the active owner. */
export const readLatestMaterials = Effect.fn(
  "contentRelease.readLatestMaterials"
)(function* (
  appLocale: Parameters<typeof loadMaterialOwner>[0],
  limit: number
) {
  yield* validateDiscoveryLimit(limit);
  const owner = yield* loadMaterialOwner(appLocale);
  const activeReleaseId = owner.active?.releaseId ?? null;
  if (!(owner.active && owner.managed && owner.slot)) {
    return {
      activeReleaseId,
      managed: false,
      materials: [],
    };
  }
  const source = yield* MaterialSource;
  const rows = yield* source.latest(owner.slot, appLocale, limit);
  const materials = yield* Effect.forEach(rows, (row) =>
    verifyMaterial(row).pipe(
      Effect.map((verified) => summarizeMaterial(verified, row.sourcePath))
    )
  );
  return {
    activeReleaseId,
    managed: true,
    materials,
  };
});
