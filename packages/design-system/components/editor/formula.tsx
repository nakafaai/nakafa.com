import {
  FormulaEdit,
  FormulaMarkup,
} from "@repo/design-system/components/editor/edit";
import {
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
  useEditorState,
} from "@tiptap/react";
import { Option } from "effect";
import { type ComponentProps, createContext, type ReactNode, use } from "react";

/** The names of the formula editor, which the page gives the formulas of its editor. */
type FormulaLabels = ComponentProps<typeof FormulaEdit>["labels"];

const FormulaLabelsContext = createContext<FormulaLabels | null>(null);

/**
 * Gives the formulas of the editor inside it the names of their editor. It wraps the editor
 * itself, because the formulas are drawn through the editor's content, which lies inside it.
 */
export function FormulaLabelsProvider({
  children,
  labels,
}: {
  children: ReactNode;
  labels: FormulaLabels;
}) {
  return <FormulaLabelsContext value={labels}>{children}</FormulaLabelsContext>;
}

/** The names of the formula editor, from the provider above the editor. */
function useFormulaLabels(): FormulaLabels {
  const labels = use(FormulaLabelsContext);
  if (labels === null) {
    // A formula is drawn only inside its editor, so a missing provider is a composition error.
    throw new Error("A formula requires FormulaLabelsProvider.");
  }
  return labels;
}

/**
 * One formula of the editor, drawn in place by KaTeX. While the editor takes changes, a press
 * opens the formula's editor, and the formula the editor saves is the attribute the node keeps.
 * The formula the writer just inserted (`toggleFormula` with no text selected) opens its editor
 * at once.
 * A read-only editor draws the formula alone. Inline and block math share this view, because
 * they differ only in the element that holds the formula.
 */
function FormulaNode({ editor, node, updateAttributes }: ReactNodeViewProps) {
  const labels = useFormulaLabels();
  const editable = useEditorState({
    editor,
    selector: ({ editor: current }) => current?.isEditable ?? false,
  });
  const block = node.type.name === "mathBlock";
  const latex: string = node.attrs.latex;
  const opening = Option.exists(
    editor.storage.formulaToggle.opening,
    (inserted) => inserted === node
  );

  return (
    <NodeViewWrapper
      as={block ? "div" : "span"}
      contentEditable={false}
      data-formula={block ? "block" : "inline"}
    >
      {editable ? (
        <FormulaEdit
          block={block}
          labels={labels}
          latex={latex}
          onSave={(next) => updateAttributes({ latex: next })}
          opening={opening}
        />
      ) : (
        <FormulaMarkup block={block} latex={latex} />
      )}
    </NodeViewWrapper>
  );
}

/**
 * The views of the two formula nodes of an assessment document. The editor and the student's
 * player draw a formula with these views, so the two show the same formula the same way.
 */
export const FORMULA_VIEWS = {
  mathBlock: ReactNodeViewRenderer(FormulaNode),
  mathInline: ReactNodeViewRenderer(FormulaNode),
};
