import {
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type TryoutSection,
  TryoutSectionSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_SECTION_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import {
  verifyTryoutCatalog,
  verifyTryoutPlacement,
} from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect, Option, Schema } from "effect";
/** Stable authored keys that select one localized try-out section. */
export interface TryoutSectionIdentity {
  readonly countryKey: TryoutSection["countryKey"];
  readonly examKey: TryoutSection["examKey"];
  readonly locale: AppLocaleCode;
  readonly sectionKey: TryoutSection["sectionKey"];
  readonly setKey: TryoutSection["setKey"];
  readonly trackKey: TryoutSection["trackKey"];
}
/** Reads one verified server-only section and all signed placements. */
export const readTryoutSection = Effect.fn("contentRelease.readTryoutSection")(
  function* (identity: TryoutSectionIdentity) {
    const owner = yield* loadTryoutOwner();
    const { snapshotId } = owner;
    const catalogIdentity = tryoutCatalogNodeIdentity({
      appLocale: AppLocaleSchema.make(identity.locale),
      countryKey: identity.countryKey,
      examKey: identity.examKey,
      kind: "section",
      sectionKey: identity.sectionKey,
      setKey: identity.setKey,
      trackKey: identity.trackKey,
    });
    const source = yield* TryoutSource;
    const storedSection = Option.getOrNull(
      yield* source.identity(snapshotId, catalogIdentity)
    );
    if (!storedSection) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Try-out section ${catalogIdentity} is unavailable.`
      );
    }
    return yield* readTryoutSectionRows(snapshotId, storedSection);
  }
);
/** Reads one already-selected signed section without repeating owner reads. */
export const readTryoutSectionRows = Effect.fn(
  "contentRelease.readTryoutSectionRows"
)(function* (
  snapshotId: string,
  storedSection: PublicationRow<"tryoutCatalog">
) {
  const catalogIdentity = storedSection.identity;
  const catalogRow = yield* verifyTryoutCatalog(storedSection, snapshotId);
  const section = yield* Schema.decodeUnknownEffect(TryoutSectionSchema)(
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
  const source = yield* TryoutSource;
  const storedPlacements = yield* source.placements(
    snapshotId,
    section,
    section.questionCount + 1
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
