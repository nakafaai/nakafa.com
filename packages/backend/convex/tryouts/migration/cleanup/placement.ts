import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadStoredTryoutPlacement } from "@repo/backend/convex/tryouts/history/rows";
import { Effect } from "effect";

type RepairItem = Pick<
  Doc<"irtScaleItems">,
  "placementIdentity" | "placementRowHash"
>;

interface SignedPlacement {
  readonly rowHash: string;
  readonly sectionIdentity: string;
}

/** Authenticates every scale item against its immutable retained placement. */
export const loadRepairPlacements = Effect.fn(
  "tryouts.migration.loadRepairPlacements"
)(function* (
  ctx: MutationCtx,
  migrationId: string,
  snapshotId: string,
  items: readonly RepairItem[]
) {
  const placements = new Map<string, SignedPlacement>();
  for (const item of items) {
    const placement = yield* loadStoredTryoutPlacement(
      ctx,
      snapshotId,
      item.placementRowHash
    ).pipe(
      Effect.catchTag("TryoutRuntimeError", () =>
        releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history scale repair could not authenticate a retained placement."
        )
      )
    );
    if (!placement) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history scale repair lost a retained placement."
      );
    }
    const mapping = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrationMaps")
        .withIndex("by_migrationId_and_kind_and_oldHash", (query) =>
          query
            .eq("migrationId", migrationId)
            .eq("kind", "placement")
            .eq("oldHash", item.placementRowHash)
        )
        .unique()
    );
    if (
      !mapping ||
      mapping.identity !== item.placementIdentity ||
      placements.has(mapping.identity)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history scale repair changed retained placement ownership."
      );
    }
    const sectionIdentity = tryoutCatalogNodeIdentity({
      appLocale: AppLocaleSchema.make(placement.locale),
      countryKey: placement.countryKey,
      examKey: placement.examKey,
      kind: "section",
      sectionKey: placement.sectionKey,
      setKey: placement.setKey,
      trackKey: placement.trackKey,
    });
    placements.set(mapping.identity, {
      rowHash: item.placementRowHash,
      sectionIdentity,
    });
  }
  return placements;
});

/** Binds each provisional item to its exact signed row and section run. */
export function matchesRepairPlacements(
  placements: ReadonlyMap<string, SignedPlacement>,
  items: readonly Doc<"irtScaleItems">[],
  runs: readonly Doc<"irtCalibrationRuns">[]
) {
  const sectionByRun = new Map(
    runs.map((run) => [run._id, run.sectionIdentity])
  );
  return (
    placements.size === items.length &&
    new Set(items.map(({ placementIdentity }) => placementIdentity)).size ===
      items.length &&
    items.every((item) => {
      const placement = placements.get(item.placementIdentity);
      return (
        placement?.rowHash === item.placementRowHash &&
        placement.sectionIdentity === sectionByRun.get(item.calibrationRunId)
      );
    })
  );
}
