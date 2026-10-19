import {
  type MathViews,
  mathExtensions,
  NO_MATH_VIEWS,
} from "@repo/editor/math";
import { type AnyExtension, getSchema } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { OrderedList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { Underline } from "@tiptap/extension-underline";
import type { Schema } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { Array as Arr } from "effect";

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
 * A span of a table cell as the page reads it: a positive whole number, and 1 for any
 * other value, as the contract stores it.
 */
function spanOf(element: HTMLElement, name: "colspan" | "rowspan") {
  const span = Number.parseInt(element.getAttribute(name) ?? "1", 10);
  return span > 0 ? span : 1;
}

/**
 * The attributes of a table cell in the contract: its two spans. Tiptap also keeps the
 * width of each column in a cell, which the contract does not store, so it is not offered.
 */
function spanAttributes() {
  return {
    colspan: {
      default: 1,
      parseHTML: (element: HTMLElement) => spanOf(element, "colspan"),
    },
    rowspan: {
      default: 1,
      parseHTML: (element: HTMLElement) => spanOf(element, "rowspan"),
    },
  };
}

/** A cell of a body row, and a cell of a header row, each with the contract's spans. */
const DocumentTableCell = TableCell.extend({ addAttributes: spanAttributes });
const DocumentTableHeader = TableHeader.extend({
  addAttributes: spanAttributes,
});

/** A row holds one cell or more, as the contract requires, where Tiptap allows none. */
const DocumentTableRow = TableRow.extend({
  content: "(tableCell | tableHeader)+",
});

/** The extension of one mark, given its priority and the rule of the link addresses. */
type MarkExtension = (
  priority: number,
  isLinkAllowed: DocumentRules["isLinkAllowed"]
) => AnyExtension;

/**
 * The extension of each mark, given its priority and the rule of the link addresses.
 * Tiptap sorts extensions by priority, and ProseMirror ranks the marks of a text node
 * in that order, so a mark's priority sets its place. The link extension sets priority
 * 1000 and the other marks keep the default, so the link would rank first. Each mark
 * therefore takes the priority of its place in the list, and the list sets the order.
 * The name of each mark is written here once, and `DocumentMark` is read from these keys.
 */
const MARKS = {
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
} satisfies Record<string, MarkExtension>;

/**
 * A mark that a document may hold. Each name is the mark's name in ProseMirror and in
 * the Aksara contract of an assessment document (ADR 0031), so the caller passes the
 * contract's own names and nothing is renamed on the way.
 */
type DocumentMark = keyof typeof MARKS;

/**
 * The extensions of an editor that holds a document of the given rules. StarterKit
 * supplies the blocks and the text, with the heading levels of the rules. Its own marks
 * are off, so no strike and no highlight is offered, and its horizontal rule is off,
 * because a document of this kind holds no rule (ADR 0031). Its ordered list is the
 * document's own, and so is its link, so each holds only the attributes the contract names.
 * A table is the contract's table, of rows and cells that hold blocks, with the spans of
 * a cell and no other attribute. The formulas are the contract's inline and block math,
 * drawn by the given views (`NO_MATH_VIEWS` draws them as plain DOM).
 */
export function documentExtensions(
  rules: DocumentRules,
  views: MathViews = NO_MATH_VIEWS
): AnyExtension[] {
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
    Table,
    DocumentTableRow,
    DocumentTableHeader,
    DocumentTableCell,
    ...mathExtensions(views),
    ...Arr.map(rules.marks, (mark, index) =>
      MARKS[mark](TOP_PRIORITY - index, rules.isLinkAllowed)
    ),
  ];
}

/** The ProseMirror schema of an editor that holds a document of the given rules. */
export function documentSchema(rules: DocumentRules): Schema {
  return getSchema(documentExtensions(rules));
}
