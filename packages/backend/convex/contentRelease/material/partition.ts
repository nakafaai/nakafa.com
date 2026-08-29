import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { Effect } from "effect";

/** Reads one complete verified material discovery partition. */
export const readMaterialPartition = Effect.fn(
  "contentRelease.readMaterialPartition"
)(function* (
  ctx: QueryCtx,
  appLocale: Doc<"materialCatalog">["appLocale"],
  bucket: string
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material discovery bucket ${bucket} is invalid.`
    );
  }
  const owner = yield* loadMaterialOwner(ctx, appLocale);
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
  const count = yield* Effect.promise(() =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
        index
          .eq("slot", owner.slot)
          .eq("appLocale", appLocale)
          .eq("bucket", bucket)
      )
      .unique()
  );
  if (!count) {
    return {
      activeReleaseId,
      kind: "missing",
    } satisfies {
      readonly activeReleaseId: typeof activeReleaseId;
      readonly kind: "missing";
    };
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_slot_and_appLocale_and_bucket_and_publicPath", (index) =>
        index
          .eq("slot", owner.slot)
          .eq("appLocale", appLocale)
          .eq("bucket", bucket)
      )
      .take(CONTENT_BUCKET_SIZE + 1)
  );
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
  return materials.length === 0
    ? ({
        activeReleaseId,
        kind: "missing",
      } satisfies {
        readonly activeReleaseId: typeof activeReleaseId;
        readonly kind: "missing";
      })
    : ({
        activeReleaseId,
        kind: "found",
        materials,
      } satisfies {
        readonly activeReleaseId: typeof activeReleaseId;
        readonly kind: "found";
        readonly materials: typeof materials;
      });
});
