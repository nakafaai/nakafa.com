import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { cn } from "cn";
import { type ComponentType, createContext, type ReactNode, use } from "react";

/** What the caller's figure reads: its attributes, the editor that holds it, and its place in the document. */
interface FigureNodeValue {
  readonly attrs: unknown;
  readonly editor: DocumentEditorInstance;
  /** Takes the figure out of its text. */
  readonly onRemove: () => void;
  /** The place of the figure in its document, or none while it has left it. */
  readonly position: number | null;
}

/** The component that draws a figure, which the app gives once. */
const FigureViewContext = createContext<ComponentType | null>(null);

/** The figure a view draws, which `FigureNode` gives each view. */
const FigureNodeContext = createContext<FigureNodeValue | null>(null);

/**
 * Gives the editors under it the component that draws a figure, which the app owns, since a figure draws the
 * app's own visuals. The value never changes.
 */
export function FiguresProvider({
  children,
  view,
}: {
  readonly children: ReactNode;
  readonly view: ComponentType;
}) {
  return <FigureViewContext value={view}>{children}</FigureViewContext>;
}

/** The figure a view draws. It throws outside a figure's node, where no view is drawn. */
export function useFigureNode(): FigureNodeValue {
  const figure = use(FigureNodeContext);
  if (figure === null) {
    throw new Error("useFigureNode must be used within a figure's node.");
  }
  return figure;
}

/** One figure in an editor: an atom that shows it is selected, drawn by the component of `FiguresProvider`. */
function FigureNode({
  deleteNode,
  editor,
  getPos,
  node,
  selected,
}: NodeViewProps) {
  const Figure = use(FigureViewContext);

  return (
    <NodeViewWrapper
      className={cn("relative rounded-lg", selected && "ring-primary ring-2")}
      contentEditable={false}
      data-figure=""
    >
      {Figure === null ? null : (
        <FigureNodeContext
          value={{
            attrs: node.attrs,
            editor,
            onRemove: deleteNode,
            position: getPos() ?? null,
          }}
        >
          <Figure />
        </FigureNodeContext>
      )}
    </NodeViewWrapper>
  );
}

/** Draws a figure of a document in its editor. */
export const FIGURE_VIEW = ReactNodeViewRenderer(FigureNode);
