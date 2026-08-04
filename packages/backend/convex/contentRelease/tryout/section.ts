import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  type TryoutSection,
  TryoutSectionSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_SECTION_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import {
  verifyTryoutCatalog,
  verifyTryoutPlacement,
} from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect, Schema } from "effect";

/** Stable authored keys that select one localized try-out section. */
export type TryoutSectionIdentity = Pick<
  TryoutSection,
  "countryKey" | "examKey" | "locale" | "sectionKey" | "setKey" | "trackKey"
>;

/** Reads one verified server-only section and all signed placements. */
export const readTryoutSection = Effect.fn("contentRelease.readTryoutSection")(
  function* (ctx: QueryCtx, identity: TryoutSectionIdentity) {
    const owner = yield* loadTryoutOwner(ctx);
    if (!(owner.managed && owner.selected)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        "The active try-out snapshot is unavailable."
      );
    }

    const { snapshotId } = owner.selected;

    const catalogIdentity = tryoutCatalogIdentity({
      ...identity,
      kind: "section",
    });
    const storedSection = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (index) =>
          index.eq("snapshotId", snapshotId).eq("identity", catalogIdentity)
        )
        .unique()
    );
    if (!storedSection) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Try-out section ${catalogIdentity} is unavailable.`
      );
    }

    return yield* readTryoutSectionRows(ctx, snapshotId, storedSection);
  }
);

/** Reads one already-selected signed section without repeating owner reads. */
export const readTryoutSectionRows = Effect.fn(
  "contentRelease.readTryoutSectionRows"
)(function* (
  ctx: QueryCtx,
  snapshotId: string,
  storedSection: Doc<"tryoutCatalog">
) {
  const catalogIdentity = storedSection.identity;
  const catalogRow = yield* verifyTryoutCatalog(storedSection, snapshotId);
  const section = yield* Schema.decodeUnknown(TryoutSectionSchema)(
    catalogRow
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Try-out section ${catalogIdentity} changed its row kind.`,
        })
    )
  );
  if (section.questionCount > TRYOUT_SECTION_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Try-out section ${catalogIdentity} exceeds ${TRYOUT_SECTION_LIMIT} placements.`
    );
  }

  const storedPlacements = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_section_and_questionOrder", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("locale", section.locale)
          .eq("countryKey", section.countryKey)
          .eq("examKey", section.examKey)
          .eq("trackKey", section.trackKey)
          .eq("setKey", section.setKey)
          .eq("sectionKey", section.sectionKey)
      )
      .take(section.questionCount + 1)
  );
  if (storedPlacements.length !== section.questionCount) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out section ${catalogIdentity} lost its signed placements.`
    );
  }

  const placements = yield* Effect.forEach(storedPlacements, (placement) =>
    verifyTryoutPlacement(placement, snapshotId).pipe(
      Effect.map((row) => ({ row, rowHash: placement.rowHash }))
    )
  );
  const hasChangedOrder = placements.some(
    ({ row }, index) => row.questionOrder !== index + 1
  );
  if (hasChangedOrder) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out section ${catalogIdentity} changed its placement order.`
    );
  }

  return {
    placements,
    section: { row: section, rowHash: storedSection.rowHash },
    snapshotId,
  };
});
