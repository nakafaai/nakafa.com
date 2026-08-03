import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type {
  TryoutSection,
  TryoutSet,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { toTryoutCorpusPath } from "@repo/backend/convex/contentRelease/tryout/path";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { migrationFail } from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";

/** Requires the exact active signed try-out snapshot selected for migration. */
export const requireTryoutSnapshot = Effect.fn(
  "tryouts.migrations.requireTryoutSnapshot"
)(function* (ctx: QueryCtx, expectedSnapshotId: string) {
  const owner = yield* loadTryoutOwner(ctx);
  if (
    !(owner.managed && owner.selected) ||
    owner.selected.snapshotId !== expectedSnapshotId
  ) {
    return yield* migrationFail(
      "The active signed try-out snapshot does not match this migration."
    );
  }

  return owner.selected;
});

/** Authenticates one legacy set against its exact signed catalog row. */
export const bindLegacySet = Effect.fn("tryouts.migrations.bindLegacySet")(
  function* (
    ctx: QueryCtx,
    expectedSnapshotId: string,
    tryoutSetId: Id<"tryoutSets"> | undefined
  ) {
    if (!tryoutSetId) {
      return yield* migrationFail(
        "A filesystem try-out set identity is missing."
      );
    }

    const legacy = yield* Effect.promise(() => ctx.db.get(tryoutSetId));
    if (!legacy) {
      return yield* migrationFail("A legacy try-out set is missing.");
    }

    const identity = tryoutCatalogIdentity({
      countryKey: legacy.countryKey,
      examKey: legacy.examKey,
      kind: "set",
      locale: legacy.locale,
      setKey: legacy.setKey,
      trackKey: legacy.trackKey,
    });
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (index) =>
          index.eq("snapshotId", expectedSnapshotId).eq("identity", identity)
        )
        .unique()
    );
    if (!stored) {
      return yield* migrationFail(`Signed try-out set ${identity} is missing.`);
    }

    const row = yield* verifyTryoutCatalog(stored, expectedSnapshotId);
    if (row.kind !== "set" || !matchesLegacySet(legacy, row)) {
      return yield* migrationFail(
        `Legacy try-out set ${identity} differs from its signed row.`
      );
    }

    return {
      identity,
      legacy,
      row,
      rowHash: stored.rowHash,
    };
  }
);

/** Authenticates one legacy section against its exact signed catalog row. */
export const bindLegacySection = Effect.fn(
  "tryouts.migrations.bindLegacySection"
)(function* (
  ctx: QueryCtx,
  expectedSnapshotId: string,
  tryoutSectionId: Id<"tryoutSections">
) {
  const legacy = yield* Effect.promise(() => ctx.db.get(tryoutSectionId));
  if (!legacy) {
    return yield* migrationFail("A legacy try-out section is missing.");
  }

  const parent = yield* bindLegacySet(
    ctx,
    expectedSnapshotId,
    legacy.tryoutSetId
  );
  if (!sectionBelongsToSet(legacy, parent.row)) {
    return yield* migrationFail(
      "A legacy try-out section differs from its parent set."
    );
  }

  const identity = tryoutCatalogIdentity({
    countryKey: legacy.countryKey,
    examKey: legacy.examKey,
    kind: "section",
    locale: legacy.locale,
    sectionKey: legacy.sectionKey,
    setKey: legacy.setKey,
    trackKey: legacy.trackKey,
  });
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_identity", (index) =>
        index.eq("snapshotId", expectedSnapshotId).eq("identity", identity)
      )
      .unique()
  );
  if (!stored) {
    return yield* migrationFail(
      `Signed try-out section ${identity} is missing.`
    );
  }

  const row = yield* verifyTryoutCatalog(stored, expectedSnapshotId);
  if (row.kind !== "section" || !matchesLegacySection(legacy, row)) {
    return yield* migrationFail(
      `Legacy try-out section ${identity} differs from its signed row.`
    );
  }

  return {
    identity,
    legacy,
    row,
    rowHash: stored.rowHash,
  };
});

/** Checks every stable field retained by a legacy set. */
function matchesLegacySet(legacy: Doc<"tryoutSets">, row: TryoutSet) {
  return (
    legacy.countryKey === row.countryKey &&
    legacy.examKey === row.examKey &&
    legacy.trackKey === row.trackKey &&
    legacy.setKey === row.setKey &&
    legacy.locale === row.locale &&
    legacy.publicPath === row.publicPath &&
    legacy.title === row.title &&
    legacy.description === row.description &&
    legacy.scoringStrategy === row.scoringStrategy &&
    legacy.internalEntrySectionKey === row.internalEntrySectionKey &&
    legacy.readyQuestionCount === row.questionCount &&
    legacy.readyVisibleSectionCount === row.visibleSectionCount &&
    legacy.sectionCount === row.sectionCount &&
    legacy.totalQuestionCount === row.questionCount &&
    legacy.visibleSectionCount === row.visibleSectionCount &&
    legacy.order === row.order &&
    legacy.sourceRevision === row.sourceRevision
  );
}

/** Checks every stable field retained by a legacy section. */
function matchesLegacySection(
  legacy: Doc<"tryoutSections">,
  row: TryoutSection
) {
  return (
    legacy.countryKey === row.countryKey &&
    legacy.examKey === row.examKey &&
    legacy.trackKey === row.trackKey &&
    legacy.setKey === row.setKey &&
    legacy.sectionKey === row.sectionKey &&
    legacy.locale === row.locale &&
    legacy.publicPath === row.publicPath &&
    legacy.title === row.title &&
    legacy.description === row.description &&
    legacy.questionCount === row.questionCount &&
    toTryoutCorpusPath(legacy.questionSourcePath) === row.questionSourcePath &&
    legacy.order === row.order &&
    legacy.sourceRevision === row.sourceRevision &&
    legacy.timeLimitSeconds === row.timeLimitSeconds &&
    legacy.visibility === row.visibility
  );
}

/** Checks that one legacy section is attached to its declared parent set. */
function sectionBelongsToSet(section: Doc<"tryoutSections">, set: TryoutSet) {
  return (
    section.countryKey === set.countryKey &&
    section.examKey === set.examKey &&
    section.trackKey === set.trackKey &&
    section.setKey === set.setKey &&
    section.locale === set.locale
  );
}
