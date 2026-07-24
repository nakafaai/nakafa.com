import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import type { BulkSyncTryoutsArgs } from "@repo/backend/convex/contentSync/tryouts/impl";
import { loadIrtQuestions } from "@repo/backend/convex/contentSync/tryouts/irt/questions";
import type {
  IrtSyncProof,
  IrtSyncSectionProof,
} from "@repo/backend/convex/contentSync/tryouts/irt/spec";
import type {
  SyncedTryoutSection,
  SyncedTryoutSet,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import {
  loadStableSet,
  verifyStableSections,
} from "@repo/backend/convex/tryouts/snapshot/catalog";
import { loadStablePlacement } from "@repo/backend/convex/tryouts/snapshot/placement";
import {
  type StableTryoutSet,
  type TryoutSetEvidence,
  tryoutSnapshotFail,
} from "@repo/backend/convex/tryouts/snapshot/spec";
import { Effect } from "effect";

type LegacySet = Doc<"tryoutSets">;
type LegacySection = Doc<"tryoutSections">;
type SectionSource = Pick<
  SyncedTryoutSection,
  | "countryKey"
  | "examKey"
  | "locale"
  | "questionCount"
  | "questionSourcePath"
  | "sectionKey"
  | "setKey"
  | "sourceRevision"
  | "timeLimitSeconds"
  | "trackKey"
>;

interface SetSource {
  readonly legacy: LegacySet | null;
  readonly row: TryoutSetEvidence;
}

/** Resolves every signed IRT identity before the sync mutation writes. */
export const resolveIrtSyncProof = Effect.fn("tryouts.irt.resolveSyncProof")(
  function* (ctx: MutationCtx, args: BulkSyncTryoutsArgs) {
    const setSources = yield* loadAffectedIrtSets(ctx, args);
    if (setSources.length === 0) {
      return { sets: [] } satisfies IrtSyncProof;
    }
    const active = yield* loadActiveSnapshot(ctx, "tryout");
    if (!active) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_IRT_PROOF_REQUIRED",
        "A verified active try-out snapshot is required for IRT sync."
      );
    }
    const sets = yield* Effect.forEach(setSources, (source) =>
      resolveSetProof(ctx, args, active.snapshotId, source)
    );
    return { sets } satisfies IrtSyncProof;
  }
);

/** Loads each distinct IRT set affected by incoming section rows. */
const loadAffectedIrtSets = Effect.fn("tryouts.irt.loadAffectedSets")(
  function* (ctx: MutationCtx, args: BulkSyncTryoutsArgs) {
    const sources: SetSource[] = [];
    for (const section of args.sections) {
      if (sources.some(({ row }) => sameSet(row, section))) {
        continue;
      }
      const incoming = args.sets.find((set) => sameSet(set, section));
      const legacy = yield* loadLegacySet(ctx, section);
      const row = incoming ?? legacy;
      if (!row) {
        return yield* tryoutSnapshotFail(
          "TRYOUT_SYNC_SET_NOT_FOUND",
          `Missing try-out set ${setLabel(section)}.`
        );
      }
      if (row.scoringStrategy === "irt") {
        sources.push({ legacy, row });
      }
    }
    return sources;
  }
);

/** Resolves one complete set, section, and placement proof tree. */
const resolveSetProof = Effect.fn("tryouts.irt.resolveSetProof")(function* (
  ctx: MutationCtx,
  args: BulkSyncTryoutsArgs,
  snapshotId: string,
  source: SetSource
) {
  const sections = yield* loadEffectiveSections(ctx, args, source);
  const stableSet = yield* loadStableSet(ctx, snapshotId, source.row);
  yield* verifyStableSections(ctx, snapshotId, stableSet, sections);
  const proofs = yield* Effect.forEach(sections, (section) =>
    resolveSectionProof(ctx, args, snapshotId, stableSet, section)
  );
  return {
    sections: proofs,
    setIdentity: stableSet.identity,
    snapshotId,
  };
});

/** Overlays incoming section rows on the bounded synchronized set snapshot. */
const loadEffectiveSections = Effect.fn("tryouts.irt.loadSections")(function* (
  ctx: MutationCtx,
  args: BulkSyncTryoutsArgs,
  source: SetSource
) {
  const legacySetId = source.legacy?._id;
  const existing = legacySetId
    ? yield* Effect.promise(() =>
        ctx.db
          .query("tryoutSections")
          .withIndex("by_tryoutSetId_and_order", (query) =>
            query.eq("tryoutSetId", legacySetId)
          )
          .take(source.row.sectionCount + 1)
      )
    : [];
  const incoming = args.sections.filter((section) =>
    sameSet(source.row, section)
  );
  const sections = overlaySections(existing, incoming);
  const questionCount = sections.reduce(
    (total, section) => total + section.questionCount,
    0
  );
  if (
    sections.length !== source.row.sectionCount ||
    questionCount !== source.row.totalQuestionCount
  ) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_IRT_SET_INCOMPLETE",
      `IRT set ${setLabel(source.row)} is not complete in this bounded sync.`
    );
  }
  return sections;
});

/** Resolves one signed section and all of its question placement identities. */
const resolveSectionProof = Effect.fn("tryouts.irt.resolveSectionProof")(
  function* (
    ctx: MutationCtx,
    args: BulkSyncTryoutsArgs,
    snapshotId: string,
    stableSet: StableTryoutSet,
    section: SectionSource
  ) {
    const questions = yield* loadIrtQuestions(ctx, args, section);
    const placements = yield* Effect.forEach(
      questions,
      ({ choices, question }) =>
        loadStablePlacement(ctx, snapshotId, stableSet, section.sectionKey, {
          answerContentKey: `${question.sourcePath}/answer`,
          choices,
          locale: question.locale,
          questionContentKey: `${question.sourcePath}/question`,
          questionOrder: question.number,
          sourceRevision: question.sourceRevision,
          title: question.title,
        }).pipe(
          Effect.map((placement) => ({
            placementIdentity: placement.identity,
            placementRowHash: placement.rowHash,
            questionSourceKey: question.sourceKey,
          }))
        )
    );
    return {
      placements,
      sectionIdentity: tryoutCatalogIdentity({
        ...stableSet,
        kind: "section",
        sectionKey: section.sectionKey,
      }),
      sectionKey: section.sectionKey,
    } satisfies IrtSyncSectionProof;
  }
);

/** Loads the current concrete set for one route identity when it exists. */
function loadLegacySet(ctx: MutationCtx, section: SectionSource) {
  return Effect.promise(() =>
    ctx.db
      .query("tryoutSets")
      .withIndex(
        "by_countryKey_and_examKey_and_trackKey_and_setKey_and_locale",
        (query) =>
          query
            .eq("countryKey", section.countryKey)
            .eq("examKey", section.examKey)
            .eq("trackKey", section.trackKey)
            .eq("setKey", section.setKey)
            .eq("locale", section.locale)
      )
      .unique()
  );
}

/** Overlays source sections by stable section key and preserves set order. */
function overlaySections(
  existing: readonly LegacySection[],
  incoming: readonly SyncedTryoutSection[]
) {
  const byKey = new Map<string, SectionSource>(
    existing.map((section) => [section.sectionKey, section])
  );
  for (const section of incoming) {
    byKey.set(section.sectionKey, section);
  }
  return [...byKey.values()].sort(
    (left, right) =>
      (incoming.find(({ sectionKey }) => sectionKey === left.sectionKey)
        ?.order ??
        existing.find(({ sectionKey }) => sectionKey === left.sectionKey)
          ?.order ??
        0) -
      (incoming.find(({ sectionKey }) => sectionKey === right.sectionKey)
        ?.order ??
        existing.find(({ sectionKey }) => sectionKey === right.sectionKey)
          ?.order ??
        0)
  );
}

/** Compares the stable route identity shared by sets and sections. */
function sameSet(
  left: Pick<
    SyncedTryoutSet,
    "countryKey" | "examKey" | "locale" | "setKey" | "trackKey"
  >,
  right: SectionSource
) {
  return (
    left.countryKey === right.countryKey &&
    left.examKey === right.examKey &&
    left.trackKey === right.trackKey &&
    left.setKey === right.setKey &&
    left.locale === right.locale
  );
}

/** Formats one stable set identity for an operator-facing error. */
function setLabel(
  source: Pick<
    TryoutSetEvidence,
    "countryKey" | "examKey" | "locale" | "setKey" | "trackKey"
  >
) {
  return `${source.countryKey}/${source.examKey}/${source.trackKey}/${source.setKey}/${source.locale}`;
}
