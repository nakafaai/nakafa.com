import { ASSESSMENT_RULES } from "@repo/backend/confect/editor/model";
import { blockDirections } from "@repo/design-system/components/editor/direction";
import { DocumentEditor } from "@repo/design-system/components/editor/document";
import {
  FORMULA_VIEWS,
  FormulaLabelsProvider,
} from "@repo/design-system/components/editor/formula";
import {
  PICTURE_VIEW,
  PicturesProvider,
} from "@repo/design-system/components/editor/picture";
import { articleProse } from "@repo/design-system/components/editor/prose";
import { documentExtensions } from "@repo/editor/document";
import { Node } from "@tiptap/pm/model";
import { use } from "react";
import { SittingPictures } from "@/components/exams/sitting/pictures";
import { assessmentSchema } from "@/lib/editor/assessment";
import { useDocumentLabels } from "@/lib/editor/labels";

/**
 * The extensions of a read-only document: the ones the exam canvas edits the same document with, and
 * the direction of each block from its own words, as the canvas gives it.
 */
const READER_EXTENSIONS = [
  ...documentExtensions(ASSESSMENT_RULES, {
    ...FORMULA_VIEWS,
    image: PICTURE_VIEW,
  }),
  blockDirections,
];

/** A prompt reads as the published article reads, its paragraphs included. */
const PAGE_EXTENSIONS = [...READER_EXTENSIONS, articleProse];

/** An option reads as the article's text too, with its paragraphs as one line of text. */
const LINE_EXTENSIONS = [
  ...READER_EXTENSIONS,
  articleProse.configure({ paragraphs: false }),
];

/** Nothing begins on a reader: a read-only document takes no file. */
const noBegin = () => undefined;

/**
 * One assessment document, read-only. The editor starts read-only and nothing turns editing on, so
 * the document reads as the exam canvas renders it. The document is the JSON object of a prompt or
 * of an option label, and the schema reads it the way the editor's own document does. A prompt
 * reads as a page, and an option as one line, the same way the exam editor sizes each.
 */
export function SittingReader({
  document,
  label,
  size = "page",
}: {
  readonly document: unknown;
  /** The accessible name of the document. */
  readonly label: string;
  /** The room the text takes at least: a prompt takes a page, and an option takes one line. */
  readonly size?: "line" | "page";
}) {
  const labels = useDocumentLabels();
  const urls = use(SittingPictures);
  const content = Node.fromJSON(assessmentSchema, document).toJSON();

  return (
    <FormulaLabelsProvider labels={labels.formulaEdit}>
      <PicturesProvider begin={noBegin} labels={labels.pictures} urls={urls}>
        <DocumentEditor
          extensions={size === "page" ? PAGE_EXTENSIONS : LINE_EXTENSIONS}
          label={label}
          onChange={() => undefined}
          onEditor={(editor) => {
            editor.commands.setContent(content, { emitUpdate: false });
          }}
          placeholder=""
          size={size}
        />
      </PicturesProvider>
    </FormulaLabelsProvider>
  );
}
