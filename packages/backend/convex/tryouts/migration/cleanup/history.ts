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
import { TryoutPlacementSourceSchema } from "@nakafa/aksara-contracts/tryout/placement";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { loadStoredTryoutPlacement } from "@repo/backend/convex/tryouts/history/rows";
import { Effect } from "effect";

type RepairItem = Pick<
  Doc<"irtScaleItems">,
  "calibrationRunId" | "placementIdentity" | "placementRowHash"
>;
type RepairRun = Pick<Doc<"irtCalibrationRuns">, "_id" | "sectionIdentity">;
type HistoricalPlacement = Extract<
  StoredTryoutRow,
  { readonly rowKind: "placement" }
>["record"]["row"];

/** Replays the exact identity-bearing fields added by the signed conversion. */
function projectHistoricalPlacement(row: HistoricalPlacement) {
  const {
    answerArtifactHash: _answerArtifactHash,
    contentHash: _contentHash,
    locale,
    questionArtifactHash: _questionArtifactHash,
    title: _title,
    ...source
  } = row;
  const appLocale = AppLocaleSchema.make(locale);
  return TryoutPlacementSourceSchema.make({
    ...source,
    answerArtifactLocale: ArtifactLocaleSchema.make(locale),
    appLocale,
    deliveryLanguage: deliveryLanguageForSection(row.sectionKey, appLocale),
    questionArtifactLocale: questionArtifactLocaleForSection(
      row.sectionKey,
      appLocale
    ),
  });
}

/** Proves the retired live rows still exist in the signed history archive. */
export const requireRepairHistory = Effect.fn(
  "tryouts.migration.requireRepairHistory"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  items: readonly RepairItem[],
  runs: readonly RepairRun[]
) {
  const [catalog, placement] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .first()
    ),
  ]);
  if (catalog !== null || placement !== null) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history repair found source rows that were not retired."
    );
  }

  const sections = new Map(runs.map((run) => [run._id, run.sectionIdentity]));
  const identities = new Set<string>();
  for (const item of items) {
    const historical = yield* loadStoredTryoutPlacement(
      ctx,
      snapshotId,
      item.placementRowHash
    ).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Try-out history repair failed historical placement authentication.",
          })
      )
    );
    if (historical === null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history repair lost one signed historical placement."
      );
    }
    const row = projectHistoricalPlacement(historical);
    const identity = tryoutPlacementIdentity(row);
    const sectionIdentity = tryoutCatalogNodeIdentity({
      appLocale: row.appLocale,
      countryKey: row.countryKey,
      examKey: row.examKey,
      kind: "section",
      sectionKey: row.sectionKey,
      setKey: row.setKey,
      trackKey: row.trackKey,
    });
    if (
      identity !== item.placementIdentity ||
      identities.has(identity) ||
      sectionIdentity !== sections.get(item.calibrationRunId)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history repair changed historical placement ownership."
      );
    }
    identities.add(identity);
  }
});
