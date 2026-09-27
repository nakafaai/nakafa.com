import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/confect/contentRelease/models/spec";
import { resolveSearchProjection } from "@repo/backend/confect/contentRelease/search/verify";
import { Effect } from "effect";

/** Validates one bounded inactive search page against candidate heads. */
export const validateSearchModel = Effect.fn(
  "contentRelease.validateSearchModel"
)(function* (
  build: Docs["contentModelBuilds"],
  release: Docs["contentReleases"]
) {
  const database = yield* DatabaseReader;
  const page = yield* database
    .table("contentIndex")
    .index("by_slot_and_contentKey_and_appLocale", (index) =>
      index.eq("slot", build.slots.searchTargetSlot)
    )
    .paginate({
      cursor: build.cursor ?? null,
      maximumBytesRead: MODEL_BUILD_PAGE_BYTES,
      maximumRowsRead: MODEL_BUILD_PAGE_ROWS,
      numItems: MODEL_BUILD_PAGE_ROWS,
    })
    .pipe(Effect.orDie);
  const owner = {
    families: release.resultFamilies,
    manifestHash: build.manifestHash,
    releaseId: build.releaseId,
    sequence: build.sequence,
    slot: build.slots.searchTargetSlot,
  };
  yield* Effect.forEach(page.page, (row) =>
    resolveSearchProjection(row, owner)
  );
  return {
    cursor: page.isDone ? undefined : page.continueCursor,
    done: page.isDone,
    processed: page.page.length,
  } satisfies ModelBuildPage;
});
