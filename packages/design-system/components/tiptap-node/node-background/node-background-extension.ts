import { updateNodesAttr } from "@repo/design-system/lib/tiptap-utils";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { NodeWithPos } from "@tiptap/react";
import { Extension } from "@tiptap/react";

export type NodeBackgroundOptions = {
  /**
   * The types of nodes that can have background color applied.
   * @default ['paragraph', 'heading']
   */
  types?: string[];
};

declare module "@tiptap/react" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Must use interface
  interface Commands<ReturnType> {
    nodeBackground: {
      /**
       * Toggle background color on selected nodes
       */
      toggleNodeBackgroundColor: (color: string) => ReturnType;
      /**
       * Remove background color from selected nodes
       */
      unsetNodeBackgroundColor: () => ReturnType;
    };
  }
}

/**
 * Extension that adds background color support to nodes.
 * This allows applying background colors to block-level nodes like paragraphs and headings.
 */
export const NodeBackground = Extension.create<NodeBackgroundOptions>({
  name: "nodeBackground",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types ?? [],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.backgroundColor || null,
            renderHTML: (attributes: { backgroundColor?: string | null }) => {
              if (!attributes.backgroundColor) {
                return {};
              }
              return {
                style: `background-color: ${attributes.backgroundColor}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      toggleNodeBackgroundColor:
        (color: string) =>
        ({
          tr,
          state,
          dispatch,
        }: {
          tr: Transaction;
          state: EditorState;
          dispatch?: ((tr: Transaction) => void) | undefined;
        }) => {
          const { selection } = state;
          const nodesWithPos: NodeWithPos[] = [];

          // Collect all nodes that should have background color applied
          state.doc.nodesBetween(
            selection.from,
            selection.to,
            (node: ProseMirrorNode, pos: number) => {
              if (
                node.isBlock &&
                this.options.types?.includes(node.type.name)
              ) {
                nodesWithPos.push({ node, pos });
              }
            }
          );

          if (nodesWithPos.length === 0) {
            return false;
          }

          if (dispatch) {
            updateNodesAttr(tr, nodesWithPos, "backgroundColor", color);
            dispatch(tr);
          }

          return true;
        },

      unsetNodeBackgroundColor:
        () =>
        ({
          tr,
          state,
          dispatch,
        }: {
          tr: Transaction;
          state: EditorState;
          dispatch?: ((tr: Transaction) => void) | undefined;
        }) => {
          const { selection } = state;
          const nodesWithPos: NodeWithPos[] = [];

          state.doc.nodesBetween(
            selection.from,
            selection.to,
            (node: ProseMirrorNode, pos: number) => {
              if (
                node.isBlock &&
                this.options.types?.includes(node.type.name)
              ) {
                nodesWithPos.push({ node, pos });
              }
            }
          );

          if (nodesWithPos.length === 0) {
            return false;
          }

          if (dispatch) {
            updateNodesAttr(tr, nodesWithPos, "backgroundColor", undefined);
            dispatch(tr);
          }

          return true;
        },
    };
  },
});

export default NodeBackground;
