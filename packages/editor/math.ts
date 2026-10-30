import { findFormulas } from "@repo/editor/formula";
import {
  type AnyExtension,
  Extension,
  mergeAttributes,
  Node,
  type NodeViewRenderer,
  PasteRule,
  type Storage,
} from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { Array as Arr, Option, String as Str } from "effect";

/** The two formula nodes: a formula inside a line of text, and a formula on a line of its own. */
type FormulaType = "mathBlock" | "mathInline";

/** The LaTeX of a formula that a writer inserts with nothing selected, which the writer changes in its editor at once. */
export const NEW_FORMULA = "x";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    formulaToggle: {
      /**
       * Turns the selected text into a formula of the type, with the text as its LaTeX, and a selected formula of the
       * type back into its LaTeX as selected text. With no text selected it inserts a new formula, whose editor opens
       * at once.
       */
      toggleFormula: (type: FormulaType) => ReturnType;
    };
  }

  interface Storage {
    formulaToggle: {
      /** The formula the writer just inserted, whose editor opens as its view first draws it. */
      opening: Option.Option<ProseMirrorNode>;
    };
  }
}

/**
 * The views of the formula nodes, which the caller gives: each is `null` when the caller shows
 * none. This package holds no view, because the schema reads a formula as an atom (ADR 0031).
 */
export type MathViews = Record<FormulaType, NodeViewRenderer | null>;

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

/**
 * Replaces the selected formula with its LaTeX as selected text: text in the line for inline math, and a paragraph
 * for block math. A formula with no LaTeX turns into no text at all.
 */
function formulaToText(tr: Transaction, latex: string, block: boolean) {
  if (latex === "") {
    tr.deleteSelection();
    return;
  }
  const { from } = tr.selection;
  const text = tr.doc.type.schema.text(latex);
  tr.replaceSelectionWith(
    block ? tr.doc.type.schema.node("paragraph", null, text) : text,
    false
  );
  const start = block ? from + 1 : from;
  tr.setSelection(TextSelection.create(tr.doc, start, start + latex.length));
}

/**
 * Turns text into a formula and a formula back into text, as Google Docs does with its equations: the toolbar and the
 * slash menu run `toggleFormula`, and so do Mod-Shift-E for inline math and Mod-Alt-E for block math. Turning a
 * formula back selects its LaTeX, so the same command turns it into the formula again.
 */
const FormulaToggle = Extension.create<
  Record<never, never>,
  Storage["formulaToggle"]
>({
  addCommands() {
    return {
      toggleFormula:
        (type) =>
        ({ dispatch, state, tr }) => {
          if (!dispatch) {
            return true;
          }
          const { from, to } = state.selection;
          if (
            state.selection instanceof NodeSelection &&
            state.selection.node.type.name === type
          ) {
            formulaToText(
              tr,
              state.selection.node.attrs.latex,
              type === "mathBlock"
            );
            return true;
          }
          const selected = Str.trim(state.doc.textBetween(from, to, " "));
          const formula = state.schema.node(type, {
            latex: selected === "" ? NEW_FORMULA : selected,
          });
          tr.replaceSelectionWith(formula).scrollIntoView();
          this.storage.opening =
            selected === "" ? Option.some(formula) : Option.none();
          return true;
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-e": () => this.editor.commands.toggleFormula("mathBlock"),
      "Mod-Shift-e": () => this.editor.commands.toggleFormula("mathInline"),
    };
  },
  addStorage() {
    return { opening: Option.none() };
  },
  name: "formulaToggle",
});

/**
 * The math of a document: its two formula nodes, drawn by the given views, the paste that makes them, and the command
 * that turns text into a formula and back.
 */
export function mathExtensions(views: MathViews): AnyExtension[] {
  return [
    MathInline.configure({ view: views.mathInline }),
    MathBlock.configure({ view: views.mathBlock }),
    MathPaste,
    FormulaToggle,
  ];
}
