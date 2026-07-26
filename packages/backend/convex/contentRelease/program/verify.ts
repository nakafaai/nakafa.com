import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

/** Authenticates one immutable catalog row and its indexed identity. */
export const verifyProgram = Effect.fn("contentRelease.verifyProgram")(
  function* (row: Doc<"programCatalog">, snapshotId: string) {
    const decoded = yield* decodeSnapshotRowJson(row.rowJson);
    if (
      decoded.family !== "program" ||
      decoded.record.kind !== "program" ||
      decoded.record.rowHash !== row.rowHash ||
      decoded.record.row.displayOrder !== row.displayOrder ||
      decoded.record.row.key !== row.programKey ||
      row.snapshotId !== snapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Program ${row.programKey} changed its immutable snapshot identity.`
      );
    }
    return decoded.record.row;
  }
);

/** Authenticates one immutable curriculum row and every indexed fact. */
export const verifyCurriculum = Effect.fn("contentRelease.verifyCurriculum")(
  function* (row: Doc<"curriculumRoutes">, snapshotId: string) {
    const decoded = yield* decodeSnapshotRowJson(row.rowJson);
    if (
      decoded.family !== "program" ||
      decoded.record.kind !== "curriculum" ||
      decoded.record.rowHash !== row.rowHash ||
      decoded.record.row.level !== row.level ||
      decoded.record.row.locale !== row.locale ||
      decoded.record.row.materialContextParentPath !== row.contextPath ||
      decoded.record.row.materialKey !== row.materialKey ||
      decoded.record.row.nodeKey !== row.nodeKey ||
      decoded.record.row.order !== row.order ||
      decoded.record.row.parentPath !== row.parentPath ||
      decoded.record.row.programKey !== row.programKey ||
      decoded.record.row.publicPath !== row.path ||
      decoded.record.row.sourcePath !== row.sourcePath ||
      row.snapshotId !== snapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Curriculum route ${row.locale}/${row.path} changed its immutable snapshot identity.`
      );
    }
    return decoded.record.row;
  }
);
