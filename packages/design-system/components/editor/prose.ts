import { markBlockDirections } from "@repo/design-system/components/editor/direction";
import { drawFormula } from "@repo/design-system/components/editor/render";
import { emphasisVariants } from "@repo/design-system/lib/markdown/emphasis";
import {
  blockGapVariants,
  codeVariants,
  headingTextVariants,
  headingVariants,
  linkVariants,
  listItemVariants,
  listVariants,
  mathBlockVariants,
  mathInlineVariants,
  mathScrollVariants,
  paragraphVariants,
  quoteVariants,
  scriptVariants,
  tableCellVariants,
  tableFrameVariants,
  tableHeadCellVariants,
  tableRowVariants,
} from "@repo/design-system/lib/prose";
import type { HeadingTag } from "@repo/design-system/types/markdown";
import { Extension } from "@tiptap/core";
import { DOMSerializer, type Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { cn } from "cn";
import { Array as Arr, MutableList, Option, Record as Rec } from "effect";

/** The element of a heading of each level that a document holds. */
const HEADING_TAGS: Record<string, HeadingTag> = {
  "1": "h1",
  "2": "h2",
  "3": "h3",
  "4": "h4",
  "5": "h5",
  "6": "h6",
};

/** A heading's box and its words, which an article draws as two elements and a document as one. */
const headingClasses = (tag: HeadingTag) =>
  cn(headingVariants({ tag }), headingTextVariants({ tag }));

/**
 * The classes of each block of a document, by the name of its node, as the published article draws
 * the block: a heading of its level, a list and its items, a quotation, a table in the lesson's frame
 * with its rows and cells, and the blocks that draw their own frame (a code block, a picture, a formula
 * on its own line), which take an article's room around them. A table's decoration lands on the
 * editor's wrapper of the table, which holds the table as the lesson's container does.
 */
const BLOCK_CLASSES: Record<string, (node: Node) => Option.Option<string>> = {
  blockquote: () => Option.some(quoteVariants()),
  bulletList: () => Option.some(listVariants({ kind: "bullet" })),
  codeBlock: () => Option.some(blockGapVariants()),
  heading: (node) =>
    Option.map(Rec.get(HEADING_TAGS, String(node.attrs.level)), headingClasses),
  image: () => Option.some(blockGapVariants()),
  listItem: () => Option.some(listItemVariants()),
  mathBlock: () => Option.some(blockGapVariants()),
  orderedList: () => Option.some(listVariants({ kind: "ordered" })),
  table: () => Option.some(tableFrameVariants()),
  tableCell: () => Option.some(tableCellVariants()),
  tableHeader: () => Option.some(tableHeadCellVariants()),
  tableRow: () => Option.some(tableRowVariants()),
};

/**
 * The class of each mark's element, as the published article draws the phrase: a bold phrase is the
 * lesson's marked phrase, a link the lesson's link, inline code its chip, and a sub- or superscript
 * its annotation size. The editor and the reader give these to `documentExtensions`, so each mark's
 * own element takes them, and a phrase that holds several marks takes its surface once.
 */
export const ARTICLE_MARKS = {
  bold: emphasisVariants(),
  code: codeVariants(),
  link: linkVariants(),
  subscript: scriptVariants(),
  superscript: scriptVariants(),
};

/** The cells of a table, whose paragraphs read as the cell's words, as a lesson's cell holds them. */
const CELL_NODES = ["tableCell", "tableHeader"];

/**
 * A decoration on each block of a document, with the classes that the published article draws it
 * with, and on each paragraph too when `paragraphs` is set. A decoration styles the view only: no
 * node changes, so the stored document is the same as before. The marks take their classes on their
 * own elements (`ARTICLE_MARKS`).
 */
const proseDecorations = (doc: Node, paragraphs: boolean) => {
  const decorations = MutableList.make<Decoration>();
  doc.descendants((node, position, parent) => {
    const end = position + node.nodeSize;
    if (
      paragraphs &&
      node.type.name === "paragraph" &&
      !Option.exists(Option.fromNullishOr(parent), (holder) =>
        Arr.contains(CELL_NODES, holder.type.name)
      )
    ) {
      MutableList.append(
        decorations,
        Decoration.node(position, end, { class: paragraphVariants() })
      );
      return;
    }
    Option.map(
      Option.flatMap(Rec.get(BLOCK_CLASSES, node.type.name), (classes) =>
        classes(node)
      ),
      (classes) =>
        MutableList.append(
          decorations,
          Decoration.node(position, end, { class: classes })
        )
    );
  });
  return DecorationSet.create(doc, MutableList.toArray(decorations));
};

/**
 * Draws a document as the published article draws its text: its headings, lists, quotations and
 * tables, and, for a prompt or a note (`paragraphs`), its paragraphs. An option's short text
 * leaves its paragraphs as one line of text.
 */
export const articleProse = Extension.create<{ paragraphs: boolean }>({
  addOptions() {
    return { paragraphs: true };
  },
  addProseMirrorPlugins() {
    const { paragraphs } = this.options;
    return [
      new Plugin({
        props: {
          decorations: (state) => proseDecorations(state.doc, paragraphs),
        },
      }),
    ];
  },
  name: "articleProse",
});

/**
 * The classes of each element of a document drawn without an editor, by the selector that finds it,
 * as the editor's decorations and marks give them, so a text that stands in for its editor takes the
 * same boxes.
 * A paragraph is left to the caller, which knows whether its text reads as an article.
 */
const ELEMENT_CLASSES = [
  ["a", ARTICLE_MARKS.link],
  ["blockquote", quoteVariants()],
  [":not(pre) > code", ARTICLE_MARKS.code],
  ["strong", ARTICLE_MARKS.bold],
  ["sub", ARTICLE_MARKS.subscript],
  ["sup", ARTICLE_MARKS.superscript],
  ["h1", headingClasses("h1")],
  ["h2", headingClasses("h2")],
  ["h3", headingClasses("h3")],
  ["li", listItemVariants()],
  ["ol", listVariants({ kind: "ordered" })],
  ["ul", listVariants({ kind: "bullet" })],
  ["tr", tableRowVariants()],
  ["th", tableHeadCellVariants()],
  ["td", tableCellVariants()],
  ['pre, [data-type="image"], [data-type="math-block"]', blockGapVariants()],
] as const;

/**
 * Holds each table in the lesson's frame, as the editor's wrapper holds it: a document drawn without an
 * editor has the table alone. A table already in its frame keeps it.
 */
function frameTables(root: HTMLElement) {
  Arr.forEach(Arr.fromIterable(root.querySelectorAll("table")), (table) => {
    if (table.parentElement?.dataset.slot === "table-frame") {
      return;
    }
    const frame = document.createElement("div");
    frame.className = tableFrameVariants();
    frame.dataset.slot = "table-frame";
    table.replaceWith(frame);
    frame.append(table);
  });
}

/**
 * Draws the formulas that the schema left as empty elements with their LaTeX, as the lesson draws them: an
 * inline formula with the lesson's inline pieces, and a formula on its own line in the lesson's card, which
 * scrolls sideways when it is wider. The editor draws the same formulas through its node view.
 */
function drawFormulas(root: HTMLElement) {
  Arr.forEach(
    Arr.fromIterable(
      root.querySelectorAll<HTMLElement>('[data-type="math-inline"]')
    ),
    (element) => {
      element.className = mathInlineVariants();
      element.innerHTML = drawFormula(element.dataset.latex ?? "", false);
    }
  );
  Arr.forEach(
    Arr.fromIterable(
      root.querySelectorAll<HTMLElement>('[data-type="math-block"]')
    ),
    (element) => {
      const card = document.createElement("div");
      card.className = mathBlockVariants();
      const row = document.createElement("div");
      row.className = mathScrollVariants();
      row.innerHTML = drawFormula(element.dataset.latex ?? "", true);
      card.append(row);
      element.replaceChildren(card);
    }
  );
}

/** Gives the elements of a document that the schema drew into `root` the classes and the formulas of the published article. */
export function drawArticleProse(root: HTMLElement) {
  Arr.forEach(ELEMENT_CLASSES, ([selector, classes]) =>
    Arr.forEach(
      Arr.fromIterable(root.querySelectorAll(selector)),
      (element) => {
        element.className = classes;
      }
    )
  );
  frameTables(root);
  drawFormulas(root);
}

/**
 * Draws a document into `root` without an editor: the schema's own rendering of each node, which is what the
 * editor draws, with each block in the direction of its own words and the published article's classes. A
 * prompt or a note (`paragraphs`) gives each paragraph the article's classes, and an option leaves them as one
 * line of text. An empty paragraph gets the line break an editor gives it, so it keeps its height.
 */
export function drawDocument(
  root: HTMLElement,
  doc: Node,
  paragraphs: boolean
) {
  root.replaceChildren(
    DOMSerializer.fromSchema(doc.type.schema).serializeFragment(doc.content)
  );
  markBlockDirections(root);
  drawArticleProse(root);
  Arr.forEach(Arr.fromIterable(root.querySelectorAll("p")), (paragraph) => {
    // A cell's paragraph reads as the cell's words, as the lesson and the editor draw it.
    if (paragraphs && paragraph.closest("td, th") === null) {
      paragraph.className = paragraphVariants();
    }
    if (paragraph.childNodes.length === 0) {
      paragraph.append(document.createElement("br"));
    }
  });
}
