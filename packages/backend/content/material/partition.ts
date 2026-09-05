import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyMaterial } from "@repo/backend/content/material/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Option } from "effect";

/** Reads one complete verified material discovery partition. */
export const readMaterialPartition = Effect.fn(
  "contentRelease.readMaterialPartition"
)(function* (
  appLocale: PublicationRow<"materialCatalog">["appLocale"],
  bucket: string
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material discovery bucket ${bucket} is invalid.`
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
  const { count: selectedCount, materials: rows } = yield* source.partition(
    owner.slot,
    appLocale,
    bucket,
    CONTENT_BUCKET_SIZE + 1
  );
  const count = Option.getOrNull(selectedCount);
  if (!count) {
    return {
      activeReleaseId,
      kind: "missing",
    } satisfies {
      readonly activeReleaseId: typeof activeReleaseId;
      readonly kind: "missing";
    };
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
  const materials = yield* Effect.forEach(rows, (row) =>
    verifyMaterial(row).pipe(Effect.map((verified) => ({ ...verified, row })))
  );
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
