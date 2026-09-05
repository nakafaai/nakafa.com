import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import { verifyCurriculum } from "@repo/backend/content/program/verify";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Option } from "effect";

/** Reads one complete verified curriculum sitemap partition. */
export const readProgramPartition = Effect.fn(
  "contentRelease.readProgramPartition"
)(function* (
  appLocale: Parameters<typeof loadProgramOwner>[0],
  bucket: string
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Program sitemap bucket ${bucket} is invalid.`
    );
  }
  const owner = yield* loadProgramOwner(appLocale);
  if (!(owner.managed && owner.selected)) {
    return { kind: "unmanaged" as const };
  }
  const { snapshotId } = owner.selected;
  const source = yield* ProgramSource;
  const { count: selectedCount, routes: rows } = yield* source.partition(
    snapshotId,
    appLocale,
    bucket,
    CONTENT_BUCKET_SIZE + 1
  );
  const count = Option.getOrNull(selectedCount);
  if (!count) {
    return { kind: "missing" as const };
  }

  if (
    rows.length !== count.routeCount ||
    rows.length === 0 ||
    rows.length > CONTENT_BUCKET_SIZE
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program sitemap bucket ${appLocale}/${bucket} has mismatched counts.`
    );
  }
  const routes = yield* Effect.forEach(rows, (row) =>
    verifyCurriculum(row, snapshotId)
  );
  return { kind: "found" as const, routes };
});
