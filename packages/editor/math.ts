import { findFormulas } from "@repo/editor/formula";
import {
  type AnyExtension,
  Extension,
  mergeAttributes,
  Node,
  type NodeViewRenderer,
  PasteRule,
} from "@tiptap/core";
import { Array as Arr } from "effect";

/**
 * The views of the formula nodes, which the caller gives: each is `null` when the caller shows
 * none. This package holds no view, because the schema reads a formula as an atom (ADR 0031).
 */
export type MathViews = Record<
  "mathBlock" | "mathInline",
  NodeViewRenderer | null
>;

/**
 * The views of an editor that shows no formula view: each node draws its own DOM.
 */
export const NO_MATH_VIEWS = {
  mathBlock: null,
  mathInline: null,
} satisfies MathViews;

/**
 * The LaTeX source of a formula, which the DOM keeps in `data-latex`. The contract stores
 * it trimmed and not empty, so a paste of blank LaTeX never makes a formula.
 */
const LATEX = {
  default: "",
  parseHTML: (element: HTMLElement) => element.getAttribute("data-latex") ?? "",
  renderHTML: (attributes: { latex: string }) => ({
    "data-latex": attributes.latex,
  }),
};

/**
 * Inline math: a formula inside a line of text, written as the contract's `mathInline`
 * with its LaTeX as the one attribute. It is an atom, so a step moves it whole.
 */
const MathInline = Node.create<{ view: NodeViewRenderer | null }>({
  name: "mathInline",
  addAttributes() {
    return { latex: LATEX };
  },
  addNodeView() {
    return this.options.view;
  },
  addOptions() {
    return { view: null };
  },
  atom: true,
  group: "inline",
  inline: true,
  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "math-inline" }),
    ];
  },
  selectable: true,
});

/**
 * Block math: a formula that stands on its own line, written as the contract's `mathBlock`
 * with its LaTeX as the one attribute. It is an atom, as inline math is.
 */
const MathBlock = Node.create<{ view: NodeViewRenderer | null }>({
  name: "mathBlock",
  addAttributes() {
    return { latex: LATEX };
  },
  addNodeView() {
    return this.options.view;
  },
  addOptions() {
    return { view: null };
  },
  atom: true,
  group: "block",
  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "math-block" }),
    ];
  },
  selectable: true,
});

/**
 * Converts the formulas of pasted text into formula nodes, where the paste lands:
 * `$...$` and `\(...\)` become inline math, and `$$...$$` and `\[...\]` become block math.
 * Every other character of the pasted text stays as it was pasted.
 */
const MathPaste = Extension.create({
  addPasteRules() {
    return [
      new PasteRule({
        find: (text) =>
          Arr.map(findFormulas(text), (formula) => ({
            index: formula.index,
            text: formula.text,
          })),
        handler: ({ chain, match, range }) => {
          const formula = findFormulas(match[0])[0];
          chain()
            .insertContentAt(range, {
              attrs: { latex: formula.latex },
              type: formula.kind === "block" ? "mathBlock" : "mathInline",
            })
            .run();
        },
      }),
    ];
  },
  name: "mathPaste",
});

/** The math of a document: its two formula nodes, drawn by the given views, and the paste that makes them. */
export function mathExtensions(views: MathViews): AnyExtension[] {
  return [
    MathInline.configure({ view: views.mathInline }),
    MathBlock.configure({ view: views.mathBlock }),
    MathPaste,
  ];
}
