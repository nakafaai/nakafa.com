import { ContentSnapshotRowSchema } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  type ContentSnapshotRow as PredecessorContentSnapshotRow,
  ContentSnapshotRowSchema as PredecessorContentSnapshotRowSchema,
} from "@nakafa/aksara-predecessor/release/snapshot/data";
import {
  deliveryLanguageForSection,
  ENGLISH_LANGUAGE_SECTION_KEY,
  INDONESIAN_LANGUAGE_SECTION_KEY,
} from "@nakafa/aksara-predecessor/tryout/language";
import { Effect, Schema } from "effect";

type PredecessorPlacementRow = Extract<
  PredecessorContentSnapshotRow,
  { readonly family: "tryout"; readonly rowKind: "placement" }
>;

const StoredSnapshotRowSchema = Schema.Union([
  ContentSnapshotRowSchema,
  PredecessorContentSnapshotRowSchema,
]);
type StoredSnapshotRow = typeof StoredSnapshotRowSchema.Type;

function isPredecessorPlacement(
  row: StoredSnapshotRow
): row is PredecessorPlacementRow {
  return (
    row.family === "tryout" &&
    row.rowKind === "placement" &&
    "choices" in row.record.row
  );
}

function predecessorLanguagePolicy(
  row: PredecessorPlacementRow["record"]["row"]
) {
  if (
    row.sectionKey === ENGLISH_LANGUAGE_SECTION_KEY ||
    row.sectionKey === INDONESIAN_LANGUAGE_SECTION_KEY
  ) {
    return {
      kind: "fixed",
      language: deliveryLanguageForSection(row.sectionKey, row.appLocale),
    };
  }
  return { kind: "app-locale" };
}

/**
 * Converts one authenticated predecessor placement into the current read model.
 *
 * Remove this bridge immediately after the full Question A/B rebuild and a
 * production audit reports zero predecessor try-out placement rows.
 */
function normalizePredecessorPlacement(source: PredecessorPlacementRow) {
  const { choices, ...identity } = source.record.row;
  return {
    family: "tryout",
    record: {
      row: {
        ...identity,
        languagePolicy: predecessorLanguagePolicy(source.record.row),
        response: {
          kind: "single-choice",
          options: choices.map(({ isCorrect, label }, index) => ({
            isCorrect,
            label,
            optionKey: `option-${index + 1}`,
            order: index + 1,
          })),
        },
      },
      rowHash: source.record.rowHash,
    },
    rowKind: "placement",
  };
}

/** Strictly decodes current or retained predecessor rows for stored reads. */
export const decodeStoredSnapshotRow = Effect.fn(
  "contentRelease.decodeStoredSnapshotRow"
)((input: unknown) =>
  Schema.decodeUnknownEffect(StoredSnapshotRowSchema, {
    onExcessProperty: "error",
  })(input).pipe(
    Effect.flatMap((row) =>
      Schema.decodeUnknownEffect(ContentSnapshotRowSchema, {
        onExcessProperty: "error",
      })(isPredecessorPlacement(row) ? normalizePredecessorPlacement(row) : row)
    )
  )
);
