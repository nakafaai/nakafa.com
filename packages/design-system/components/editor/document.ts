import { type AnyExtension, getSchema } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Underline } from "@tiptap/extension-underline";
import type { Schema } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { Array as Arr } from "effect";

/**
 * A mark that a document may hold. Each name is the mark's name in ProseMirror and in
 * the Aksara contract of an assessment document (ADR 0031), so the caller passes the
 * contract's own names and nothing is renamed on the way.
 */
export type DocumentMark =
  | "bold"
  | "code"
  | "italic"
  | "link"
  | "subscript"
  | "superscript"
  | "underline";

/** The priority of the first mark of a list. Each later mark takes one less, so the list sets the order. */
const TOP_PRIORITY = 1000;

/**
 * The extension of each mark, given its priority. Tiptap sorts extensions by priority,
 * and ProseMirror ranks the marks of a text node in that order, so a mark's priority
 * sets its place. The link extension sets priority 1000 and the other marks keep the
 * default, so the link would rank first. Each mark therefore takes the priority of its
 * place in the list, and the list sets the order.
 */
const MARKS: Record<DocumentMark, (priority: number) => AnyExtension> = {
  bold: (priority) => Bold.extend({ priority }),
  code: (priority) => Code.extend({ priority }),
  italic: (priority) => Italic.extend({ priority }),
  link: (priority) =>
    Link.extend({ priority }).configure({
      autolink: true,
      defaultProtocol: "https",
      openOnClick: false,
    }),
  subscript: (priority) => Subscript.extend({ priority }),
  superscript: (priority) => Superscript.extend({ priority }),
  underline: (priority) => Underline.extend({ priority }),
};

/**
 * The extensions of an editor that holds a document with exactly the marks it is given,
 * in the order it is given them. StarterKit supplies the blocks and the text. Its own
 * marks are off, so no strike is offered, and no highlight is added, because a document
 * writes only the marks of its contract.
 */
function documentExtensions(marks: readonly DocumentMark[]): AnyExtension[] {
  return [
    StarterKit.configure({
      bold: false,
      code: false,
      italic: false,
      link: false,
      strike: false,
      underline: false,
    }),
    ...Arr.map(marks, (mark, index) => MARKS[mark](TOP_PRIORITY - index)),
  ];
}

/** The ProseMirror schema of an editor that holds a document with the marks it is given. */
export function documentSchema(marks: readonly DocumentMark[]): Schema {
  return getSchema(documentExtensions(marks));
}
