import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadReleaseItems } from "@repo/backend/convex/contentRelease/model";
import { Effect } from "effect";

export interface ModelItemPage {
  readonly done: boolean;
  readonly nextIndex: number;
  readonly rows: readonly Doc<"contentItems">[];
}

/** Loads one bounded, contiguous page inside the signed release item count. */
export const loadModelItems = Effect.fn("contentRelease.loadModelItems")(
  function* (
    ctx: MutationCtx,
    release: Doc<"contentReleases">,
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
    const page = yield* loadReleaseItems(ctx, release.releaseId, afterIndex);
    for (const [offset, row] of page.page.entries()) {
      if (row.index !== afterIndex + offset + 1) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Model build ${release.releaseId} lost contiguous item ${afterIndex + offset + 1}.`
        );
      }
    }
    const nextIndex = page.page.at(-1)?.index ?? afterIndex;
    if (page.isDone && nextIndex !== completedIndex) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Model build ${release.releaseId} stopped at item ${nextIndex}.`
      );
    }
    if (!page.isDone && page.page.length === 0) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Model build ${release.releaseId} stopped without progress.`
      );
    }
    return {
      done: page.isDone,
      nextIndex,
      rows: page.page,
    } satisfies ModelItemPage;
  }
);
