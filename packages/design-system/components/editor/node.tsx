import { PopupContainer } from "@repo/design-system/lib/popup";
import { NodeViewWrapper } from "@tiptap/react";
import type { ComponentProps } from "react";

/**
 * The element of every node view an editor draws. ProseMirror owns the DOM of its document, and a node whose DOM takes
 * the focus or the selection is drawn again, so a popup drawn inside the node, such as a picture's alt text dialog or
 * a formula's editor, would close the moment it took the focus. The popups of a node view therefore render in the
 * page's body (`PopupContainer`), outside the document, and React still carries their events through the node.
 */
export function EditorNodeView(props: ComponentProps<typeof NodeViewWrapper>) {
  return (
    <PopupContainer
      value={typeof document === "undefined" ? null : document.body}
    >
      <NodeViewWrapper {...props} />
    </PopupContainer>
  );
}
