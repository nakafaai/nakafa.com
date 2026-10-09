import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import contentItemsTable from "@repo/backend/confect/_generated/tables/contentItems";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadReleaseItems } from "@repo/backend/confect/contentRelease/model";
import { Array as Arr, Effect, Option, Schema } from "effect";

const ModelItemPageSchema = Schema.Struct({
  done: Schema.Boolean,
  nextIndex: Schema.Finite,
  rows: Schema.Array(contentItemsTable.Doc),
});
type ModelItemPage = typeof ModelItemPageSchema.Type;

/** Loads one bounded, contiguous page inside the signed release item count. */
export const loadModelItems = Effect.fn("contentRelease.loadModelItems")(
  function* (
    release: Docs["contentReleases"],
    signed: SignedContentRelease,
    afterIndex: number
  ) {
    const completedIndex = signed.manifest.itemCount - 1;
    if (afterIndex > completedIndex) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Model build ${release.releaseId} advanced beyond item ${completedIndex}.`
      );
    }
    const page = yield* loadReleaseItems(release.releaseId, afterIndex);
    const gap = Arr.findFirstIndex(
      page.page,
      (row, offset) => row.index !== afterIndex + offset + 1
    );
    if (Option.isSome(gap)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Model build ${release.releaseId} lost contiguous item ${afterIndex + gap.value + 1}.`
      );
    }
    const nextIndex = Option.match(Arr.last(page.page), {
      onNone: () => afterIndex,
      onSome: (row) => row.index,
    });
    if (page.isDone && nextIndex !== completedIndex) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Model build ${release.releaseId} stopped at item ${nextIndex}.`
      );
    }
    return {
      done: page.isDone,
      nextIndex,
      rows: page.page,
    } satisfies ModelItemPage;
  }
);
