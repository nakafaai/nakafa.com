import { isHttpsUrl } from "@nakafa/aksara-contracts/text/syntax";
import { MarkTypeSchema } from "@repo/backend/confect/editor/node";
import {
  type DocumentMark,
  type DocumentRules,
  documentSchema,
} from "@repo/design-system/components/editor/document";
import { Schema } from "effect";

/**
 * The marks of an assessment document, in the order the contract writes them: its plain
 * marks, then its link. The server admits the same names in a step (`MarkTypeSchema`),
 * so the editor offers the marks that the contract and the server accept, and no second
 * list is kept (ADR 0028, ADR 0031).
 */
export const ASSESSMENT_MARKS: readonly DocumentMark[] =
  MarkTypeSchema.literals;

/**
 * The heading levels of an assessment document (ADR 0031). The contract does not export
 * them, so `assessment.test.ts` pins them against the contract's own check.
 */
const HeadingLevelSchema = Schema.Literals([1, 2, 3]);

/**
 * The rules of an assessment document (ADR 0031): its marks, its heading levels, and its
 * links, which the contract takes only at an absolute https address. The editor refuses a
 * link to any other address, whether a reader types it or pastes it.
 */
export const ASSESSMENT_RULES: DocumentRules = {
  headingLevels: HeadingLevelSchema.literals,
  isLinkAllowed: isHttpsUrl,
  marks: ASSESSMENT_MARKS,
};

/** The ProseMirror schema of an assessment document, with the rules of the contract. */
export const assessmentSchema = documentSchema(ASSESSMENT_RULES);
