import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

type ProgramRow = Extract<ContentSnapshotRow, { readonly family: "program" }>;

/** Stores one immutable program row at its exact signed snapshot index. */
export const stageProgramRow = Effect.fn("contentRelease.stageProgramRow")(
  function* (
    ctx: MutationCtx,
    snapshotId: string,
    index: number,
    source: ProgramRow,
    rowJson: string
  ) {
    const byIndex = yield* Effect.promise(() =>
      ctx.db
        .query("programRows")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId).eq("index", index)
        )
        .unique()
    );
    if (byIndex) {
      if (
        byIndex.rowJson !== rowJson ||
        byIndex.rowHash !== source.record.rowHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Program snapshot ${snapshotId} has a row identity collision.`
        );
      }
      return true;
    }
    const row = {
      index,
      rowHash: source.record.rowHash,
      rowJson,
      snapshotId,
    };
    yield* ensureDocumentSize(
      `Program snapshot ${snapshotId} row ${index}`,
      row
    );
    yield* Effect.promise(() => ctx.db.insert("programRows", row));
    return false;
  }
);
