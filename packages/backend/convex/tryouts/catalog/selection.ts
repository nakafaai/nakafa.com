import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type {
  TryoutSection,
  TryoutSet,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import type { PublishedCatalogIndex } from "@repo/backend/convex/tryouts/catalog/hierarchy";
import {
  readTryoutCatalogRowByIdentity,
  readTryoutCatalogRowByPath,
} from "@repo/backend/convex/tryouts/catalog/row";
import { Effect } from "effect";

/** Reads the verified parent and section rows needed for one set route. */
export const readTryoutSetSelection = Effect.fn(
  "tryouts.catalog.readSetSelection"
)(function* (
  ctx: QueryCtx,
  input: {
    readonly locale: "en" | "id";
    readonly publicPath: string;
    readonly snapshotId: string;
  }
) {
  const selected = yield* readTryoutCatalogRowByPath(
    ctx,
    input.snapshotId,
    input
  );
  if (selected?.kind !== "set" && selected?.kind !== "section") {
    return null;
  }

  let set: TryoutSet | null = selected.kind === "set" ? selected : null;
  if (!set) {
    const setIdentity = tryoutCatalogIdentity({
      countryKey: selected.countryKey,
      examKey: selected.examKey,
      kind: "set",
      locale: selected.locale,
      setKey: selected.setKey,
      trackKey: selected.trackKey,
    });
    const setRow = yield* readTryoutCatalogRowByIdentity(
      ctx,
      input.snapshotId,
      setIdentity
    );
    if (setRow?.kind !== "set") {
      return yield* selectionIntegrity("Signed try-out section lost its set.");
    }
    set = setRow;
  }

  const parentIdentities = {
    country: tryoutCatalogIdentity({
      countryKey: set.countryKey,
      kind: "country",
      locale: set.locale,
    }),
    exam: tryoutCatalogIdentity({
      countryKey: set.countryKey,
      examKey: set.examKey,
      kind: "exam",
      locale: set.locale,
    }),
    track: tryoutCatalogIdentity({
      countryKey: set.countryKey,
      examKey: set.examKey,
      kind: "track",
      locale: set.locale,
      trackKey: set.trackKey,
    }),
  };
  const selectedRows = yield* Effect.all(
    {
      country: readTryoutCatalogRowByIdentity(
        ctx,
        input.snapshotId,
        parentIdentities.country
      ),
      exam: readTryoutCatalogRowByIdentity(
        ctx,
        input.snapshotId,
        parentIdentities.exam
      ),
      sections: readSetSections(ctx, input.snapshotId, set),
      track: readTryoutCatalogRowByIdentity(
        ctx,
        input.snapshotId,
        parentIdentities.track
      ),
    },
    { concurrency: "unbounded" }
  );
  if (selectedRows.country?.kind !== "country") {
    return yield* selectionIntegrity("Signed try-out set lost its country.");
  }
  if (selectedRows.exam?.kind !== "exam") {
    return yield* selectionIntegrity("Signed try-out set lost its exam.");
  }
  if (selectedRows.track?.kind !== "track") {
    return yield* selectionIntegrity("Signed try-out set lost its track.");
  }

  const index: PublishedCatalogIndex = {
    countries: [selectedRows.country],
    exams: [selectedRows.exam],
    sections: selectedRows.sections,
    sets: [set],
    tracks: [selectedRows.track],
  };
  return index;
});

/** Reads and verifies the complete bounded section family for one signed set. */
const readSetSections = Effect.fn("tryouts.catalog.readSetSections")(function* (
  ctx: QueryCtx,
  snapshotId: string,
  set: TryoutSet
) {
  if (set.sectionCount > TRYOUT_CATALOG_LIMIT) {
    return yield* selectionIntegrity(
      `Try-out set exceeds ${TRYOUT_CATALOG_LIMIT} sections.`
    );
  }
  const setIdentity = tryoutCatalogIdentity(set);
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_setIdentity_and_kind_and_order", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("setIdentity", setIdentity)
          .eq("kind", "section")
      )
      .take(set.sectionCount + 1)
  );
  if (stored.length !== set.sectionCount) {
    return yield* selectionIntegrity(
      "Signed try-out set lost one or more sections."
    );
  }
  const rows = yield* Effect.forEach(stored, (row) =>
    verifyTryoutCatalog(row, snapshotId)
  );
  const sections: TryoutSection[] = [];
  for (const row of rows) {
    if (row.kind !== "section") {
      return yield* selectionIntegrity(
        "Signed try-out set contains another row kind."
      );
    }
    sections.push(row);
  }
  return sections;
});

/** Rejects a malformed set-local catalog selection. */
function selectionIntegrity(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
