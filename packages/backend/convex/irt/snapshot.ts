import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
  tryoutPlacementParentIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import {
  IrtIdentityError,
  irtIdentityFail,
} from "@repo/backend/convex/irt/error";
import { Effect } from "effect";

/** Decodes and verifies one stored signed try-out catalog row. */
export const requireIrtCatalog = Effect.fn("irt.requireIdentityCatalog")(
  function* (
    ctx: MutationCtx,
    snapshotId: string,
    identity: string,
    kind: "section" | "set"
  ) {
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (query) =>
          query.eq("snapshotId", snapshotId).eq("identity", identity)
        )
        .unique()
    );
    if (!stored || stored.kind !== kind) {
      return yield* irtIdentityFail(
        `Try-out snapshot ${snapshotId} is missing ${kind} ${identity}.`
      );
    }
    const source = yield* decodeSnapshotRowJson(stored.rowJson).pipe(
      Effect.mapError(
        () =>
          new IrtIdentityError({
            code: "IRT_IDENTITY_MIGRATION",
            message: `Try-out snapshot ${snapshotId} has an invalid ${kind} row.`,
          })
      )
    );
    if (
      source.family !== "tryout" ||
      source.rowKind !== "catalog" ||
      source.record.row.kind !== kind ||
      source.record.rowHash !== stored.rowHash ||
      tryoutCatalogIdentity(source.record.row) !== stored.identity
    ) {
      return yield* irtIdentityFail(
        `Try-out snapshot ${snapshotId} has a mismatched ${kind} row.`
      );
    }
    return source.record.row;
  }
);

/** Decodes and verifies one exact signed placement row. */
export const requireIrtPlacement = Effect.fn("irt.requireIdentityPlacement")(
  function* (stored: Doc<"tryoutPlacements">, sectionIdentity: string) {
    const source = yield* decodeSnapshotRowJson(stored.rowJson).pipe(
      Effect.mapError(
        () =>
          new IrtIdentityError({
            code: "IRT_IDENTITY_MIGRATION",
            message: `Try-out placement ${stored.identity} is invalid.`,
          })
      )
    );
    if (
      source.family !== "tryout" ||
      source.rowKind !== "placement" ||
      source.record.rowHash !== stored.rowHash ||
      tryoutPlacementIdentity(source.record.row) !== stored.identity ||
      tryoutPlacementParentIdentity(source.record.row) !== sectionIdentity
    ) {
      return yield* irtIdentityFail(
        `Try-out placement ${stored.identity} has mismatched signed identity.`
      );
    }
    return source.record.row;
  }
);
