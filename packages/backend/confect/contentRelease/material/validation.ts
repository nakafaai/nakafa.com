import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/confect/contentRelease/models/spec";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { Effect } from "effect";

/** Validates one bounded inactive material page against candidate heads. */
export const validateMaterialModel = Effect.fn(
  "contentRelease.validateMaterialModel"
)(function* (build: Docs["contentModelBuilds"]) {
  const database = yield* DatabaseReader;
  const page = yield* database
    .table("materialCatalog")
    .index("by_slot_and_contentKey_and_appLocale", (index) =>
      index.eq("slot", build.slots.materialTargetSlot)
    )
    .paginate({
      cursor: build.cursor ?? null,
      maximumBytesRead: MODEL_BUILD_PAGE_BYTES,
      maximumRowsRead: MODEL_BUILD_PAGE_ROWS,
      numItems: MODEL_BUILD_PAGE_ROWS,
    })
    .pipe(Effect.orDie);
  yield* Effect.forEach(page.page, (row) =>
    verifyEffectiveMaterial(row, build.sequence).pipe(
      Effect.provide(publicationLayer)
    )
  );
  return {
    cursor: page.isDone ? undefined : page.continueCursor,
    done: page.isDone,
    processed: page.page.length,
  } satisfies ModelBuildPage;
});
