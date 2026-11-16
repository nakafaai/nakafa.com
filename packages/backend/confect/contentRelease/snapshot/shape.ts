import assessmentRows from "@repo/backend/confect/_generated/tables/assessmentRows";
import curriculumRoutes from "@repo/backend/confect/_generated/tables/curriculumRoutes";
import programCatalog from "@repo/backend/confect/_generated/tables/programCatalog";
import quranRows from "@repo/backend/confect/_generated/tables/quranRows";
import quranSearch from "@repo/backend/confect/_generated/tables/quranSearch";
import { Schema, Struct } from "effect";

/** The fields the staging mutation adds once the ledger places a row. */
const PLACE_FIELDS = ["index", "snapshotId"] as const;

/** A program catalog document before its snapshot and index place it. */
export const ProgramDocumentSchema = programCatalog.Fields.mapFields(
  Struct.omit(PLACE_FIELDS)
);

/** A curriculum route document before its snapshot and index place it. */
export const CurriculumDocumentSchema = curriculumRoutes.Fields.mapFields(
  Struct.omit(PLACE_FIELDS)
);

/** A Quran row document before its snapshot and index place it. */
export const QuranDocumentSchema = quranRows.Fields.mapFields(
  Struct.omit(PLACE_FIELDS)
);

/** A Quran search document before its snapshot and index place it. */
export const QuranSearchDocumentSchema = quranSearch.Fields.mapFields(
  Struct.omit(PLACE_FIELDS)
);

/** An assessment row document before its snapshot and index place it. */
export const AssessmentDocumentSchema = assessmentRows.Fields.mapFields(
  Struct.omit(PLACE_FIELDS)
);

/**
 * One snapshot row the ingress action decoded, re-encoded, derived and sized,
 * so the staging mutation only reads its indexes and inserts it.
 */
export const PreparedRowSchema = Schema.Union([
  Schema.Struct({
    document: ProgramDocumentSchema,
    kind: Schema.Literal("program"),
  }),
  Schema.Struct({
    document: CurriculumDocumentSchema,
    kind: Schema.Literal("curriculum"),
  }),
  Schema.Struct({
    document: QuranDocumentSchema,
    kind: Schema.Literal("quran"),
    search: Schema.optionalKey(QuranSearchDocumentSchema),
  }),
  Schema.Struct({
    document: AssessmentDocumentSchema,
    kind: Schema.Literal("assessment"),
  }),
]);
