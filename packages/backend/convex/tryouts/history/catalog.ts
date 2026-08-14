import type { StoredTryoutRow } from "@nakafa/aksara-history/history/decode";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import { loadStoredTryoutRows } from "@repo/backend/convex/tryouts/history/rows";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import {
  matchesAttemptIdentity,
  readAttemptSetIdentity,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { Effect } from "effect";

type StoredCatalogEnvelope = Extract<
  StoredTryoutRow,
  { readonly rowKind: "catalog" }
>;
type StoredCatalogRow = StoredCatalogEnvelope["record"]["row"];
type StoredCountry = Extract<StoredCatalogRow, { readonly kind: "country" }>;
type StoredExam = Extract<StoredCatalogRow, { readonly kind: "exam" }>;
type StoredSection = Extract<StoredCatalogRow, { readonly kind: "section" }>;
type StoredSet = Extract<StoredCatalogRow, { readonly kind: "set" }>;
type StoredTrack = Extract<StoredCatalogRow, { readonly kind: "track" }>;
type TryoutAttempt = Doc<"tryoutAttempts">;

/** Projects one retained set page from authenticated historical rows only. */
export const readStoredAttemptSetPage = Effect.fn(
  "tryouts.history.readStoredSetPage"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt, publicPath: string) {
  const selection = yield* loadAttemptCatalog(ctx, attempt);
  if (selection.set.publicPath !== publicPath) {
    return yield* historyCatalogIntegrity(
      "Retained try-out set path no longer matches its attempt."
    );
  }
  return {
    exam: toPublicExam(selection.exam),
    entrySection: selection.entrySection
      ? toPublicSection(selection.entrySection)
      : null,
    set: toPublicSet(selection.set),
    sections: selection.visibleSections.map(toPublicSection),
    track: toPublicTrack(selection.track),
  };
});

/** Projects one retained visible section page from authenticated old rows. */
export const readStoredAttemptSectionPage = Effect.fn(
  "tryouts.history.readStoredSectionPage"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt, publicPath: string) {
  const selection = yield* loadAttemptCatalog(ctx, attempt);
  const section = selection.visibleSections.find(
    (candidate) => candidate.publicPath === publicPath
  );
  if (!section) {
    return yield* historyCatalogIntegrity(
      "Retained try-out section path is outside its attempt snapshot."
    );
  }
  return {
    exam: toPublicExam(selection.exam),
    section: toPublicSection(section),
    set: toPublicSet(selection.set),
    track: toPublicTrack(selection.track),
  };
});

/** Loads authenticated rows and proves their exact attempt-owned hierarchy. */
const loadAttemptCatalog = Effect.fn("tryouts.history.loadAttemptCatalog")(
  function* (ctx: QueryCtx, attempt: TryoutAttempt) {
    const decoded = yield* loadStoredTryoutRows(
      ctx,
      attempt.tryoutSnapshotId,
      "catalog"
    );
    const rows = decoded.flatMap((envelope) =>
      envelope.rowKind === "catalog" ? [envelope.record.row] : []
    );
    const identity = readAttemptSetIdentity(attempt);
    if (attempt.appLocale !== identity.locale) {
      return yield* historyCatalogIntegrity(
        "Retained try-out app locale no longer matches its frozen route locale."
      );
    }
    const set = findAttemptSet(rows, attempt, identity);
    const country = rows.find(
      (row): row is StoredCountry =>
        row.kind === "country" &&
        row.locale === identity.locale &&
        row.countryKey === identity.countryKey
    );
    const exam = rows.find(
      (row): row is StoredExam =>
        row.kind === "exam" &&
        row.locale === identity.locale &&
        row.countryKey === identity.countryKey &&
        row.examKey === identity.examKey
    );
    const track = rows.find(
      (row): row is StoredTrack =>
        row.kind === "track" && matchesTrackIdentity(row, identity)
    );
    const sections = rows
      .filter(
        (row): row is StoredSection =>
          row.kind === "section" &&
          matchesSetIdentity(row, identity) &&
          row.setKey === identity.setKey
      )
      .sort((left, right) => left.order - right.order);
    if (!(country && exam && track && set)) {
      return yield* historyCatalogIntegrity(
        "Retained try-out catalog lost an attempt-owned hierarchy row."
      );
    }
    if (
      set.questionCount !== attempt.totalQuestions ||
      set.scoringStrategy !== attempt.scoringStrategy ||
      sections.length !== attempt.sectionSnapshots.length
    ) {
      return yield* historyCatalogIntegrity(
        "Retained try-out catalog no longer matches its attempt inventory."
      );
    }
    const records = decoded.flatMap((envelope) =>
      envelope.rowKind === "catalog" ? [envelope.record] : []
    );
    for (const snapshot of attempt.sectionSnapshots) {
      const record = records.find(
        ({ row }) =>
          row.kind === "section" &&
          row.sectionKey === snapshot.sectionKey &&
          matchesSetIdentity(row, identity) &&
          row.setKey === identity.setKey
      );
      if (!(record && matchesSectionSnapshot(record, snapshot))) {
        return yield* historyCatalogIntegrity(
          "Retained try-out section no longer matches its attempt snapshot."
        );
      }
    }
    const entrySection = set.internalEntrySectionKey
      ? (sections.find(
          (section) => section.sectionKey === set.internalEntrySectionKey
        ) ?? null)
      : null;
    const visibleSections = sections.filter(
      (section) => section.visibility === "visible"
    );
    if (
      (entrySection !== null && entrySection.visibility !== "internal-entry") ||
      visibleSections.length !== set.visibleSectionCount
    ) {
      return yield* historyCatalogIntegrity(
        "Retained try-out section visibility no longer matches its set."
      );
    }
    return { country, entrySection, exam, set, track, visibleSections };
  }
);

/** Selects the sole stored set referenced by one retained attempt. */
function findAttemptSet(
  rows: readonly StoredCatalogRow[],
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity
) {
  return rows.find(
    (row): row is StoredSet =>
      row.kind === "set" &&
      matchesSetIdentity(row, identity) &&
      row.setKey === identity.setKey &&
      row.publicPath === attempt.setPublicPath
  );
}

/** Checks the shared authored parent identity of one stored hierarchy row. */
function matchesSetIdentity(
  row: StoredSet | StoredSection,
  identity: TryoutSetIdentity
) {
  return matchesAttemptIdentity(identity, {
    countryKey: row.countryKey,
    examKey: row.examKey,
    locale: row.locale,
    setKey: row.setKey,
    trackKey: row.trackKey,
  });
}

/** Checks a stored track against the shared parent identity of an attempt. */
function matchesTrackIdentity(row: StoredTrack, identity: TryoutSetIdentity) {
  return (
    row.locale === identity.locale &&
    row.countryKey === identity.countryKey &&
    row.examKey === identity.examKey &&
    row.trackKey === identity.trackKey
  );
}

/** Checks immutable section facts against their attempt-owned snapshot. */
function matchesSectionSnapshot(
  record: StoredCatalogEnvelope["record"],
  snapshot: TryoutAttempt["sectionSnapshots"][number]
) {
  const row = record.row;
  return (
    row.kind === "section" &&
    record.rowHash === snapshot.sectionRowHash &&
    row.order === snapshot.sectionOrder &&
    row.publicPath === snapshot.publicPath &&
    row.questionCount === snapshot.questionCount &&
    row.questionSourcePath === snapshot.questionSourcePath &&
    row.sourceRevision === snapshot.sourceRevision &&
    row.timeLimitSeconds === snapshot.timeLimitSeconds
  );
}

function toPublicExam(exam: StoredExam) {
  return {
    description: exam.description,
    examKey: exam.examKey,
    publicPath: exam.publicPath,
    scoringStrategy: exam.scoringStrategy,
    title: exam.title,
  };
}

function toPublicTrack(track: StoredTrack) {
  return {
    description: track.description,
    publicPath: track.publicPath,
    readyQuestionCount: track.questionCount,
    readySetCount: track.setCount,
    readyVisibleSectionCount: track.visibleSectionCount,
    title: track.title,
    trackKey: track.trackKey,
    trackKind: track.trackKind,
  };
}

function toPublicSet(set: StoredSet) {
  return {
    countryKey: set.countryKey,
    description: set.description,
    examKey: set.examKey,
    publicPath: set.publicPath,
    readyQuestionCount: set.questionCount,
    readyVisibleSectionCount: set.visibleSectionCount,
    scoringStrategy: set.scoringStrategy,
    sectionCount: set.sectionCount,
    setKey: set.setKey,
    title: set.title,
    totalQuestionCount: set.questionCount,
    trackKey: set.trackKey,
    visibleSectionCount: set.visibleSectionCount,
  };
}

function toPublicSection(section: StoredSection) {
  return {
    description: section.description,
    publicPath: section.publicPath,
    questionCount: section.questionCount,
    sectionKey: section.sectionKey,
    timeLimitSeconds: section.timeLimitSeconds,
    title: section.title,
    visibility: section.visibility,
  };
}

/** Creates one stable fail-closed historical catalog error. */
function historyCatalogIntegrity(message: string) {
  return new TryoutRuntimeError({
    code: "TRYOUT_HISTORY_CATALOG_INTEGRITY",
    message,
  });
}
