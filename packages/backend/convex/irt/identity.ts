import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { irtIdentityFail } from "@repo/backend/convex/irt/error";
import {
  requireIrtCatalog,
  requireIrtPlacement,
} from "@repo/backend/convex/irt/snapshot";
import { Effect } from "effect";

type IrtItem = Doc<"irtScaleItems">;
type IrtRun = Doc<"irtCalibrationRuns">;
type IrtScale = Doc<"irtScaleVersions">;

/** One additive identity patch prepared without writing live data. */
export interface IrtIdentityPatch {
  readonly itemPatches: readonly {
    readonly id: Id<"irtScaleItems">;
    readonly placementIdentity: string;
    readonly placementRowHash: string;
  }[];
  readonly runPatches: readonly {
    readonly id: Id<"irtCalibrationRuns">;
    readonly scaleVersionId: Id<"irtScaleVersions">;
    readonly sectionIdentity: string;
  }[];
  readonly scalePatches: readonly {
    readonly id: Id<"irtScaleVersions">;
    readonly setIdentity: string;
    readonly tryoutSnapshotId: string;
  }[];
}

/** Rejects a pre-existing additive value that disagrees with signed content. */
const requireCompatible = Effect.fn("irt.requireCompatibleIdentity")(
  (label: string, current: string | undefined, expected: string) =>
    current === undefined || current === expected
      ? Effect.void
      : irtIdentityFail(`${label} already has a conflicting identity.`)
);

/** Builds the contract-owned set identity for one legacy scale root. */
const prepareScale = Effect.fn("irt.prepareScaleIdentity")(function* (
  ctx: MutationCtx,
  snapshotId: string,
  scale: IrtScale
) {
  const set = yield* Effect.promise(() => ctx.db.get(scale.tryoutSetId));
  if (!set || set.totalQuestionCount !== scale.questionCount) {
    return yield* irtIdentityFail(
      `IRT scale ${scale._id} lost its exact legacy set.`
    );
  }
  const identity = tryoutCatalogIdentity({
    countryKey: set.countryKey,
    examKey: set.examKey,
    kind: "set",
    locale: set.locale,
    setKey: set.setKey,
    trackKey: set.trackKey,
  });
  yield* requireIrtCatalog(ctx, snapshotId, identity, "set");
  yield* requireCompatible(
    `IRT scale ${scale._id} snapshot`,
    scale.tryoutSnapshotId,
    snapshotId
  );
  yield* requireCompatible(
    `IRT scale ${scale._id} set`,
    scale.setIdentity,
    identity
  );
  return {
    id: scale._id,
    pending:
      scale.tryoutSnapshotId === undefined || scale.setIdentity === undefined,
    setIdentity: identity,
    tryoutSnapshotId: snapshotId,
  };
});

/** Loads one exact run's legacy questions and signed placements. */
const loadRunSources = Effect.fn("irt.loadRunIdentitySources")(function* (
  ctx: MutationCtx,
  snapshotId: string,
  run: IrtRun,
  items: readonly IrtItem[]
) {
  const section = yield* Effect.promise(() => ctx.db.get(run.tryoutSectionId));
  if (!section || items.length !== run.questionCount) {
    return yield* irtIdentityFail(
      `IRT run ${run._id} lost its exact legacy section or item count.`
    );
  }
  const sectionIdentity = tryoutCatalogIdentity({
    countryKey: section.countryKey,
    examKey: section.examKey,
    kind: "section",
    locale: section.locale,
    sectionKey: section.sectionKey,
    setKey: section.setKey,
    trackKey: section.trackKey,
  });
  yield* requireIrtCatalog(ctx, snapshotId, sectionIdentity, "section");
  const [questions, placements] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("questions")
        .withIndex("by_questionSetId_and_number", (query) =>
          query.eq("questionSetId", section.questionSetId)
        )
        .take(run.questionCount + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_parentKey_and_questionOrder", (query) =>
          query.eq("snapshotId", snapshotId).eq("parentKey", sectionIdentity)
        )
        .take(run.questionCount + 1)
    ),
  ]);
  if (
    questions.length !== run.questionCount ||
    placements.length !== run.questionCount
  ) {
    return yield* irtIdentityFail(
      `IRT run ${run._id} does not have one exact signed placement per question.`
    );
  }
  const decoded = yield* Effect.forEach(placements, (placement) =>
    requireIrtPlacement(placement, sectionIdentity).pipe(
      Effect.map((row) => ({ row, stored: placement }))
    )
  );
  return { decoded, questions, section, sectionIdentity };
});

/** Verifies one legacy scale item against its exact signed placement. */
const prepareItem = Effect.fn("irt.prepareItemIdentity")(function* (
  item: IrtItem,
  questions: readonly Doc<"questions">[],
  placements: readonly {
    readonly row: TryoutPlacement;
    readonly stored: Doc<"tryoutPlacements">;
  }[]
) {
  const question = questions.find(({ _id }) => _id === item.questionId);
  const placement = question
    ? placements.find(({ row }) => row.questionOrder === question.number)
    : undefined;
  if (
    !(question && placement) ||
    item.questionSourceKey !== question.sourceKey ||
    item.sourceRevision !== question.sourceRevision ||
    item.contentHash !== question.contentHash ||
    placement.row.locale !== question.locale ||
    placement.row.sourceRevision !== question.sourceRevision ||
    placement.row.questionContentKey !== `${question.sourcePath}/question`
  ) {
    return yield* irtIdentityFail(
      `IRT item ${item._id} does not match one exact signed placement.`
    );
  }
  yield* requireCompatible(
    `IRT item ${item._id} placement`,
    item.placementIdentity,
    placement.stored.identity
  );
  yield* requireCompatible(
    `IRT item ${item._id} row hash`,
    item.placementRowHash,
    placement.stored.rowHash
  );
  return {
    id: item._id,
    pending:
      item.placementIdentity === undefined ||
      item.placementRowHash === undefined,
    placementIdentity: placement.stored.identity,
    placementRowHash: placement.stored.rowHash,
  };
});

/** Resolves every additive IRT identity before any migration write begins. */
export const resolveIrtIdentityPatch = Effect.fn("irt.resolveIdentityPatch")(
  function* (
    ctx: MutationCtx,
    snapshotId: string,
    scales: readonly IrtScale[],
    items: readonly IrtItem[],
    runs: readonly IrtRun[]
  ) {
    const scalePatches = yield* Effect.forEach(scales, (scale) =>
      prepareScale(ctx, snapshotId, scale)
    );
    const runPatches: (IrtIdentityPatch["runPatches"][number] & {
      readonly pending: boolean;
    })[] = [];
    const itemPatches: (IrtIdentityPatch["itemPatches"][number] & {
      readonly pending: boolean;
    })[] = [];
    for (const run of runs) {
      const runItems = items.filter(
        ({ calibrationRunId }) => calibrationRunId === run._id
      );
      const scaleIds = new Set(
        runItems.map(({ scaleVersionId }) => scaleVersionId)
      );
      const scaleVersionId = [...scaleIds].at(0);
      const scale = scales.find(({ _id }) => _id === scaleVersionId);
      if (
        scaleIds.size !== 1 ||
        scaleVersionId === undefined ||
        scale === undefined
      ) {
        return yield* irtIdentityFail(
          `IRT run ${run._id} does not belong to exactly one scale.`
        );
      }
      const source = yield* loadRunSources(ctx, snapshotId, run, runItems);
      if (source.section.tryoutSetId !== scale.tryoutSetId) {
        return yield* irtIdentityFail(
          `IRT run ${run._id} does not belong to its scale's legacy set.`
        );
      }
      yield* requireCompatible(
        `IRT run ${run._id} scale`,
        run.scaleVersionId,
        scaleVersionId
      );
      yield* requireCompatible(
        `IRT run ${run._id} section`,
        run.sectionIdentity,
        source.sectionIdentity
      );
      runPatches.push({
        id: run._id,
        pending:
          run.scaleVersionId === undefined || run.sectionIdentity === undefined,
        scaleVersionId,
        sectionIdentity: source.sectionIdentity,
      });
      const prepared = yield* Effect.forEach(runItems, (item) =>
        prepareItem(item, source.questions, source.decoded)
      );
      itemPatches.push(...prepared);
    }
    if (itemPatches.length !== items.length) {
      return yield* irtIdentityFail(
        "IRT identity migration left one scale item without a run."
      );
    }
    return {
      itemPatches: itemPatches
        .filter(({ pending }) => pending)
        .map(({ id, placementIdentity, placementRowHash }) => ({
          id,
          placementIdentity,
          placementRowHash,
        })),
      runPatches: runPatches
        .filter(({ pending }) => pending)
        .map(({ id, scaleVersionId, sectionIdentity }) => ({
          id,
          scaleVersionId,
          sectionIdentity,
        })),
      scalePatches: scalePatches
        .filter(({ pending }) => pending)
        .map(({ id, setIdentity, tryoutSnapshotId }) => ({
          id,
          setIdentity,
          tryoutSnapshotId,
        })),
    };
  }
);
