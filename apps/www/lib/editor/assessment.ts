import { ASSESSMENT_RULES } from "@repo/backend/confect/editor/model";
import { documentSchema } from "@repo/editor/document";

/**
 * The ProseMirror schema of the assessment editor. It is built from the rules that the
 * server folds with, through the one set of extensions of `@repo/editor/document`, so the
 * editor and the server hold the same document (ADR 0028, ADR 0031).
 */
export const assessmentSchema = documentSchema(ASSESSMENT_RULES);
