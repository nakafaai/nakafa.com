import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  type TryoutSection,
  TryoutSectionSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
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
            .eq("locale", identity.locale)
            .eq("countryKey", identity.countryKey)
            .eq("examKey", identity.examKey)
            .eq("trackKey", identity.trackKey)
            .eq("setKey", identity.setKey)
            .eq("sectionKey", identity.sectionKey)
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
  }
);
