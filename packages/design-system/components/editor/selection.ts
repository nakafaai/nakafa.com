import { cva } from "class-variance-authority";

/**
 * What a selection of an editable document looks like where the browser draws none: a selected picture
 * or formula takes the focus ring, the selected cells of a table the accent of a selected row, and the
 * cursor between two blocks the text's own colour, so each shows in every theme. ProseMirror marks them
 * with its own classes, and an element around the editor takes these.
 */
export const editorSelection = cva(
  "[&_.ProseMirror-gapcursor]:after:border-foreground [&_.ProseMirror-selectednode]:ring-ring/50 [&_.selectedCell]:bg-accent [&_.selectedCell]:text-accent-foreground [&_.ProseMirror-selectednode]:rounded-md [&_.ProseMirror-selectednode]:ring-3"
);
