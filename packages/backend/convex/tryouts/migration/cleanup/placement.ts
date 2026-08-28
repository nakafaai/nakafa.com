import type { StoredTryoutRow } from "@nakafa/aksara-contracts/history/decode";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  tryoutCatalogNodeIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import {
  deliveryLanguageForSection,
  questionArtifactLocaleForSection,
} from "@nakafa/aksara-contracts/tryout/language";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  loadStoredTryoutCatalogRows,
  loadStoredTryoutPlacementRows,
} from "@repo/backend/convex/tryouts/history/rows";
import { Effect, Array as EffectArray } from "effect";

/** Authenticates every signed source placement selected by the repair runs. */
export const verifyRepairPlacements = Effect.fn(
  "tryouts.migration.verifyRepairPlacements"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  catalogRowCount: number,
  placementRowCount: number,
  items: readonly Doc<"irtScaleItems">[],
  runs: readonly Doc<"irtCalibrationRuns">[]
) {
  const { catalog, placements } = yield* Effect.all({
    catalog: loadStoredTryoutCatalogRows(ctx, snapshotId, catalogRowCount),
    placements: loadStoredTryoutPlacementRows(
      ctx,
      snapshotId,
      placementRowCount
    ),
  }).pipe(Effect.mapError(repairSourceError));
  const sectionRows = catalog.flatMap(({ record }) =>
    record.row.kind === "section" ? [record.row] : []
  );
  const sections = new Map(
    sectionRows.map((row) => [historicalSectionIdentity(row), row] as const)
  );
  const runById = new Map(runs.map((run) => [run._id, run]));
  if (sections.size !== sectionRows.length || runById.size !== runs.length) {
    return yield* repairPlacementFailure();
  }
  for (const run of runs) {
    const section = sections.get(run.sectionIdentity);
    if (!section || section.questionCount !== run.questionCount) {
      return yield* repairPlacementFailure();
    }
  }
  const placementsBySection = EffectArray.groupBy(placements, ({ record }) =>
    historicalSectionIdentity(record.row)
  );
  const signedPlacements = new Map<
    string,
    { readonly rowHash: string; readonly sectionIdentity: string }
  >();
  for (const run of runs) {
    const source = placementsBySection[run.sectionIdentity] ?? [];
    if (
      source.length !== run.questionCount ||
      source.some(({ record }, index) => record.row.questionOrder !== index + 1)
    ) {
      return yield* repairPlacementFailure();
    }
    for (const { record } of source) {
      const placementIdentity = historicalPlacementIdentity(record.row);
      if (signedPlacements.has(placementIdentity)) {
        return yield* repairPlacementFailure();
      }
      signedPlacements.set(placementIdentity, {
        rowHash: record.rowHash,
        sectionIdentity: run.sectionIdentity,
      });
    }
  }
  const itemPlacementIdentities = new Set(
    items.map(({ placementIdentity }) => placementIdentity)
  );
  if (
    itemPlacementIdentities.size !== items.length ||
    itemPlacementIdentities.size !== signedPlacements.size ||
    [...signedPlacements.keys()].some(
      (identity) => !itemPlacementIdentities.has(identity)
    ) ||
    items.some((item) => {
      const placement = signedPlacements.get(item.placementIdentity);
      const run = runById.get(item.calibrationRunId);
      return (
        !(placement && run) ||
        placement.rowHash !== item.placementRowHash ||
        placement.sectionIdentity !== run.sectionIdentity
      );
    })
  ) {
    return yield* repairPlacementFailure();
  }
});

type HistoricalSection = Extract<
  Extract<StoredTryoutRow, { readonly rowKind: "catalog" }>["record"]["row"],
  { readonly kind: "section" }
>;
type HistoricalPlacement = Extract<
  StoredTryoutRow,
  { readonly rowKind: "placement" }
>["record"]["row"];

/** Projects one retained row through Aksara's current section identity. */
function historicalSectionIdentity(
  row: HistoricalPlacement | HistoricalSection
) {
  return tryoutCatalogNodeIdentity({
    appLocale: AppLocaleSchema.make(row.locale),
    countryKey: row.countryKey,
    examKey: row.examKey,
    kind: "section",
    sectionKey: row.sectionKey,
    setKey: row.setKey,
    trackKey: row.trackKey,
  });
}

/** Projects one retained row through Aksara's current placement identity. */
function historicalPlacementIdentity(row: HistoricalPlacement) {
  const { locale, ...placement } = row;
  const appLocale = AppLocaleSchema.make(locale);
  return tryoutPlacementIdentity({
    ...placement,
    answerArtifactLocale: ArtifactLocaleSchema.make(locale),
    appLocale,
    deliveryLanguage: deliveryLanguageForSection(
      placement.sectionKey,
      appLocale
    ),
    questionArtifactLocale: questionArtifactLocaleForSection(
      placement.sectionKey,
      appLocale
    ),
  });
}

/** Maps retained-history failures into the signed cleanup boundary. */
function repairSourceError() {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message: "Try-out history scale repair lost its signed source rows.",
  });
}

/** Fails one mismatch without exposing immutable historical row bytes. */
function repairPlacementFailure() {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    "Try-out history scale repair changed signed placement ownership."
  );
}
