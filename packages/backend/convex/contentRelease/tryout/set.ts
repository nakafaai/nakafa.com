import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  type TryoutSet,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_SET_QUESTION_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { readTryoutSectionRows } from "@repo/backend/convex/contentRelease/tryout/section";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect, Schema } from "effect";

/** Stable authored keys that select one localized signed try-out set. */
export type TryoutSetIdentity = Pick<
  TryoutSet,
  "countryKey" | "examKey" | "locale" | "setKey" | "trackKey"
>;

/** Loads one complete verified set snapshot for immutable attempt creation. */
export const readTryoutSet = Effect.fn("contentRelease.readTryoutSet")(
  function* (ctx: QueryCtx, identity: TryoutSetIdentity) {
    const owner = yield* loadTryoutOwner(ctx);
    if (!(owner.managed && owner.selected)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        "The active try-out snapshot is unavailable."
      );
    }

    const { snapshotId } = owner.selected;
    const setIdentity = tryoutCatalogIdentity({ ...identity, kind: "set" });
    const storedSet = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (index) =>
          index.eq("snapshotId", snapshotId).eq("identity", setIdentity)
        )
        .unique()
    );
    if (!storedSet) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Try-out set ${setIdentity} is unavailable.`
      );
    }
    const catalogRow = yield* verifyTryoutCatalog(storedSet, snapshotId);
    const setRow = yield* Schema.decodeUnknown(TryoutSetSchema)(
      catalogRow
    ).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Try-out set ${setIdentity} changed its row kind.`,
          })
      )
    );
    if (setRow.questionCount > TRYOUT_SET_QUESTION_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Try-out set ${setIdentity} exceeds ${TRYOUT_SET_QUESTION_LIMIT} placements.`
      );
    }
    if (setRow.sectionCount > setRow.questionCount) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} has more sections than questions.`
      );
    }

    const storedSections = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex(
          "by_snapshotId_and_setIdentity_and_kind_and_order",
          (index) =>
            index
              .eq("snapshotId", snapshotId)
              .eq("setIdentity", setIdentity)
              .eq("kind", "section")
        )
        .take(setRow.sectionCount + 1)
    );
    if (storedSections.length !== setRow.sectionCount) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} lost one or more signed sections.`
      );
    }
    const sections = yield* Effect.forEach(storedSections, (storedSection) =>
      readTryoutSectionRows(ctx, snapshotId, storedSection)
    );
    const questionCount = sections.reduce(
      (total, { section }) => total + section.row.questionCount,
      0
    );
    const hasChangedOrder = sections.some(
      ({ section }, index) => section.row.order !== index + 1
    );
    if (hasChangedOrder || questionCount !== setRow.questionCount) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} lost one or more signed sections.`
      );
    }

    const set = { row: setRow, rowHash: storedSet.rowHash };
    const entrySectionKey = setRow.internalEntrySectionKey;
    if (
      entrySectionKey &&
      !sections.some(
        ({ section }) =>
          section.row.sectionKey === entrySectionKey &&
          section.row.visibility === "internal-entry"
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} lost its internal entry section.`
      );
    }
    return { sections, set, setIdentity, snapshotId };
  }
);

/** Complete authenticated set state frozen into one new attempt. */
export type VerifiedTryoutSet = Effect.Effect.Success<
  ReturnType<typeof readTryoutSet>
>;
