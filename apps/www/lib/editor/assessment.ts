import { MarkSchema } from "@nakafa/aksara-contracts/assessment/inline";
import {
  type DocumentMark,
  documentSchema,
} from "@repo/design-system/components/editor/document";

/**
 * The marks of an assessment document in the order the contract writes them: its plain
 * marks, then its link. The names come from the contract's mark schema, the one the text
 * of an assessment document uses, so the editor offers the marks the contract accepts,
 * and no second list is kept (ADR 0028, ADR 0031).
 */
const [plain, link] = MarkSchema.members;
export const ASSESSMENT_MARKS: readonly DocumentMark[] = [
  ...plain.fields.type.literals,
  link.fields.type.literal,
];

/** The ProseMirror schema of an assessment document: the contract's marks, in the contract's order. */
export const assessmentSchema = documentSchema(ASSESSMENT_MARKS);
