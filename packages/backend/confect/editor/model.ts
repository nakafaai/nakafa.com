import { isHttpsUrl } from "@nakafa/aksara-contracts/text/syntax";
import { MarkTypeSchema } from "@repo/backend/confect/editor/node";
import { type DocumentRules, documentSchema } from "@repo/editor/document";
import { Schema } from "effect";

/**
 * The heading levels of an assessment document. The contract does not export them, so
 * `assessment.test.ts` pins them against the contract's own check (ADR 0031).
 */
const HeadingLevelSchema = Schema.Literals([1, 2, 3]);

/**
 * The rules of an assessment document (ADR 0031): its marks in the contract's order, its
 * heading levels, and its links, which the contract takes only at an absolute https
 * address. The editor and the server both build their schema from these rules, through the
 * one set of extensions in `@repo/editor/document`, so the two cannot drift (ADR 0028).
 */
export const ASSESSMENT_RULES: DocumentRules = {
  headingLevels: HeadingLevelSchema.literals,
  isLinkAllowed: isHttpsUrl,
  marks: MarkTypeSchema.literals,
};

/**
 * The ProseMirror schema of an assessment document, with which the server folds stored
 * steps. A step makes the same document here as in the editor (ADR 0028).
 */
export const assessmentModel = documentSchema(ASSESSMENT_RULES);
