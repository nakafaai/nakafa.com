import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { cn } from "cn";
import { type ComponentType, createContext, type ReactNode, use } from "react";

/** What the caller's figure reads: its attributes, the editor that holds it, and its place in the document. */
interface FigureViewProps {
  readonly attrs: unknown;
  readonly editor: DocumentEditorInstance;
  /** Takes the figure out of its text. */
  readonly onRemove: () => void;
  /** The place of the figure in its document, or none while it has left it. */
  readonly position: number | null;
}

const FigureViewContext = createContext<ComponentType<FigureViewProps> | null>(
  null
);

/**
 * Gives the editors under it the component that draws a figure, which the app owns, since a figure draws the
 * app's own visuals. The value never changes.
 */
export function FiguresProvider({
  children,
  view,
}: {
  readonly children: ReactNode;
  readonly view: ComponentType<FigureViewProps>;
}) {
  return <FigureViewContext value={view}>{children}</FigureViewContext>;
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
        <Figure
          attrs={node.attrs}
          editor={editor}
          onRemove={deleteNode}
          position={getPos() ?? null}
        />
      )}
    </NodeViewWrapper>
  );
}

/** Draws a figure of a document in its editor. */
export const FIGURE_VIEW = ReactNodeViewRenderer(FigureNode);
