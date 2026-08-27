import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

type MapKind = "catalog" | "placement";
type TargetTryoutRow = Extract<
  ContentSnapshotRow,
  { readonly family: "tryout" }
>;

/** Loads one exact old-to-current row mapping from the authorized ledger. */
export const loadMapping = Effect.fn("tryouts.migration.loadAttemptMapping")(
  function* (
    ctx: MutationCtx,
    migrationId: string,
    kind: MapKind,
    oldHash: string
  ) {
    const mapping = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrationMaps")
        .withIndex("by_migrationId_and_kind_and_oldHash", (query) =>
          query
            .eq("migrationId", migrationId)
            .eq("kind", kind)
            .eq("oldHash", oldHash)
        )
        .unique()
    );
    if (!mapping) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Retained attempt lost its ${kind} conversion mapping.`
      );
    }
    return mapping;
  }
);

/** Loads one immutable target row and rechecks all duplicated lookup facts. */
export const loadTargetRow = Effect.fn(
  "tryouts.migration.loadAttemptTargetRow"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  mapping: Doc<"tryoutHistoryMigrationMaps">
) {
  const table =
    mapping.kind === "catalog" ? "tryoutCatalog" : "tryoutPlacements";
  const stored =
    table === "tryoutCatalog"
      ? yield* Effect.promise(() =>
          ctx.db
            .query(table)
            .withIndex("by_snapshotId_and_identity", (query) =>
              query
                .eq("snapshotId", snapshotId)
                .eq("identity", mapping.identity)
            )
            .unique()
        )
      : yield* Effect.promise(() =>
          ctx.db
            .query(table)
            .withIndex("by_snapshotId_and_identity", (query) =>
              query
                .eq("snapshotId", snapshotId)
                .eq("identity", mapping.identity)
            )
            .unique()
        );
  if (!stored || stored.rowHash !== mapping.newHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained attempt lost its converted target row."
    );
  }
  const row = yield* decodeSnapshotRowJson(stored.rowJson);
  if (row.family !== "tryout" || row.record.rowHash !== stored.rowHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Converted target row changed its immutable identity."
    );
  }
  if (mapping.kind === "catalog") {
    if (row.rowKind !== "catalog") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted target row changed its row kind."
      );
    }
    return row satisfies TargetTryoutRow;
  }
  if (row.rowKind !== "placement") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Converted target row changed its row kind."
    );
  }
  return row satisfies TargetTryoutRow;
});
