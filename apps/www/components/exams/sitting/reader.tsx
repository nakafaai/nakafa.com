"use client";

import { ASSESSMENT_RULES } from "@repo/backend/confect/editor/model";
import { DocumentEditor } from "@repo/design-system/components/editor/document";
import {
  FORMULA_VIEWS,
  FormulaLabelsProvider,
} from "@repo/design-system/components/editor/formula";
import { articleParagraphs } from "@repo/design-system/components/editor/paragraph";
import { documentExtensions } from "@repo/editor/document";
import { Node } from "@tiptap/pm/model";
import { assessmentSchema } from "@/lib/editor/assessment";
import { useDocumentLabels } from "@/lib/editor/labels";

/** The extensions of a read-only document: the ones the exam canvas edits the same document with. */
const READER_EXTENSIONS = [
  ...documentExtensions(ASSESSMENT_RULES, FORMULA_VIEWS),
  articleParagraphs,
];

/**
 * One assessment document, read-only. The editor starts read-only and nothing turns editing on, so
 * the document reads as the exam canvas renders it. The document is the JSON object of a prompt or
 * of an option label, and the schema reads it the way the editor's own document does.
 */
export function SittingReader({
  document,
  label,
}: {
  readonly document: unknown;
  /** The accessible name of the document. */
  readonly label: string;
}) {
  const labels = useDocumentLabels();
  const content = Node.fromJSON(assessmentSchema, document).toJSON();

  return (
    <FormulaLabelsProvider labels={labels.formulaEdit}>
      <DocumentEditor
        extensions={READER_EXTENSIONS}
        label={label}
        onChange={() => undefined}
        onEditor={(editor) => {
          editor.commands.setContent(content, { emitUpdate: false });
        }}
        placeholder=""
      />
    </FormulaLabelsProvider>
  );
}
