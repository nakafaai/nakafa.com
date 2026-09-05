import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type {
  TryoutSection,
  TryoutSet,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutSectionSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import {
  tryoutCatalogIdentity,
  tryoutCatalogNodeIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { PublishedCatalogIndex } from "@repo/backend/content/tryout/hierarchy";
import {
  readTryoutCatalogRowByIdentity,
  readTryoutCatalogRowByPath,
} from "@repo/backend/content/tryout/row";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect, Schema } from "effect";

/** One authenticated section row with its signed immutable digest. */
export interface SelectedTryoutSection {
  readonly row: TryoutSection;
  readonly rowHash: Doc<"tryoutCatalog">["rowHash"];
}

/** Complete verified set-local catalog needed by public and attempt reads. */
export interface TryoutSetSelection extends PublishedCatalogIndex {
  readonly sectionRecords: readonly SelectedTryoutSection[];
}

/** Reads the verified parent and section rows needed for one set route. */
export const readTryoutSetSelection = Effect.fn(
  "tryouts.catalog.readSetSelection"
)(function* (input: {
  readonly appLocale: AppLocaleCode;
  readonly publicPath: string;
  readonly snapshotId: string;
}) {
  const selected = yield* readTryoutCatalogRowByPath(input.snapshotId, input);
  if (selected?.kind !== "set" && selected?.kind !== "section") {
    return null;
  }

  let set: TryoutSet | null = selected.kind === "set" ? selected : null;
  if (!set) {
    const setIdentity = tryoutCatalogNodeIdentity({
      appLocale: selected.appLocale,
      countryKey: selected.countryKey,
      examKey: selected.examKey,
      kind: "set",
      setKey: selected.setKey,
      trackKey: selected.trackKey,
    });
    const setRow = yield* readTryoutCatalogRowByIdentity(
      input.snapshotId,
      setIdentity
    );
    if (setRow?.kind !== "set") {
      return yield* selectionIntegrity("Signed try-out section lost its set.");
    }
    set = setRow;
  }

  const parentIdentities = {
    country: tryoutCatalogNodeIdentity({
      appLocale: set.appLocale,
      countryKey: set.countryKey,
      kind: "country",
    }),
    exam: tryoutCatalogNodeIdentity({
      appLocale: set.appLocale,
      countryKey: set.countryKey,
      examKey: set.examKey,
      kind: "exam",
    }),
    track: tryoutCatalogNodeIdentity({
      appLocale: set.appLocale,
      countryKey: set.countryKey,
      examKey: set.examKey,
      kind: "track",
      trackKey: set.trackKey,
    }),
  };
  const selectedRows = yield* Effect.all(
    {
      country: readTryoutCatalogRowByIdentity(
        input.snapshotId,
        parentIdentities.country
      ),
      exam: readTryoutCatalogRowByIdentity(
        input.snapshotId,
        parentIdentities.exam
      ),
      sectionRecords: readTryoutSetSections(input.snapshotId, set),
      track: readTryoutCatalogRowByIdentity(
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

  const index: TryoutSetSelection = {
    countries: [selectedRows.country],
    exams: [selectedRows.exam],
    sectionRecords: selectedRows.sectionRecords,
    sections: selectedRows.sectionRecords.map(({ row }) => row),
    sets: [set],
    tracks: [selectedRows.track],
  };
  return index;
});

/**
 * Reads and verifies the complete bounded section family for one signed set.
 * @see https://docs.convex.dev/database/reading-data/indexes/
 */
export const readTryoutSetSections = Effect.fn(
  "tryouts.catalog.readSetSections"
)(function* (snapshotId: string, set: TryoutSet) {
  if (set.sectionCount > TRYOUT_CATALOG_LIMIT) {
    return yield* selectionIntegrity(
      `Try-out set exceeds ${TRYOUT_CATALOG_LIMIT} sections.`
    );
  }
  const setIdentity = tryoutCatalogIdentity(set);
  const source = yield* TryoutSource;
  const stored = yield* source.sections(
    snapshotId,
    setIdentity,
    set.sectionCount + 1
  );
  if (stored.length !== set.sectionCount) {
    return yield* selectionIntegrity(
      "Signed try-out set lost one or more sections."
    );
  }
  const sections: SelectedTryoutSection[] = [];
  for (const storedSection of stored) {
    const catalogRow = yield* verifyTryoutCatalog(storedSection, snapshotId);
    const row = yield* Schema.decodeUnknownEffect(TryoutSectionSchema)(
      catalogRow
    ).pipe(Effect.orDie);
    sections.push({ row, rowHash: storedSection.rowHash });
  }
  return sections;
});

/** Rejects a malformed set-local catalog selection. */
function selectionIntegrity(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
