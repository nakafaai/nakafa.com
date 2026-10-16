import { type AnyExtension, getSchema } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { OrderedList } from "@tiptap/extension-list";
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

/** A heading level, which Tiptap numbers from 1 to 6. */
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The rules that make an editor hold one kind of document: the marks it may hold, in
 * their order, the heading levels it may hold, and the addresses a link may take. This
 * package holds no contract, so the caller gives the rules, and an assessment document
 * gives the contract's (ADR 0031).
 */
export interface DocumentRules {
  readonly headingLevels: readonly HeadingLevel[];
  readonly isLinkAllowed: (href: string) => boolean;
  readonly marks: readonly DocumentMark[];
}

/** The priority of the first mark of a list. Each later mark takes one less, so the list sets the order. */
const TOP_PRIORITY = 1000;

/**
 * The ordered list of a document. It holds its start, which the contract names, and no
 * other attribute: Tiptap's own `type` is a list style that the stored text drops, so an
 * editor that held it would measure a document larger than the snapshot stores (ADR 0028).
 */
const DocumentOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      start: {
        default: 1,
        parseHTML: (element) =>
          Number.parseInt(element.getAttribute("start") ?? "1", 10),
      },
    };
  },
});

/**
 * The extension of each mark, given its priority and the rule of the link addresses.
 * Tiptap sorts extensions by priority, and ProseMirror ranks the marks of a text node
 * in that order, so a mark's priority sets its place. The link extension sets priority
 * 1000 and the other marks keep the default, so the link would rank first. Each mark
 * therefore takes the priority of its place in the list, and the list sets the order.
 */
const MARKS: Record<
  DocumentMark,
  (
    priority: number,
    isLinkAllowed: DocumentRules["isLinkAllowed"]
  ) => AnyExtension
> = {
  bold: (priority) => Bold.extend({ priority }),
  code: (priority) => Code.extend({ priority }),
  italic: (priority) => Italic.extend({ priority }),
  link: (priority, isLinkAllowed) =>
    Link.extend({
      addAttributes() {
        return {
          href: {
            default: null,
            parseHTML: (element) => element.getAttribute("href"),
          },
        };
      },
      priority,
    }).configure({
      autolink: true,
      defaultProtocol: "https",
      isAllowedUri: isLinkAllowed,
      openOnClick: false,
    }),
  subscript: (priority) => Subscript.extend({ priority }),
  superscript: (priority) => Superscript.extend({ priority }),
  underline: (priority) => Underline.extend({ priority }),
};

/**
 * The extensions of an editor that holds a document of the given rules. StarterKit
 * supplies the blocks and the text, with the heading levels of the rules. Its own marks
 * are off, so no strike and no highlight is offered, and its horizontal rule is off,
 * because a document of this kind holds no rule (ADR 0031). Its ordered list is the
 * document's own, and so is its link, so each holds only the attributes the contract names.
 */
export function documentExtensions(rules: DocumentRules): AnyExtension[] {
  return [
    StarterKit.configure({
      bold: false,
      code: false,
      heading: { levels: [...rules.headingLevels] },
      horizontalRule: false,
      italic: false,
      link: false,
      orderedList: false,
      strike: false,
      underline: false,
    }),
    DocumentOrderedList,
    ...Arr.map(rules.marks, (mark, index) =>
      MARKS[mark](TOP_PRIORITY - index, rules.isLinkAllowed)
    ),
  ];
}

/** The ProseMirror schema of an editor that holds a document of the given rules. */
export function documentSchema(rules: DocumentRules): Schema {
  return getSchema(documentExtensions(rules));
}
