import {
  editorBar,
  editorDocument,
  editorFrame,
  editorPlaceholder,
  editorRow,
  editorScroll,
} from "@repo/design-system/components/editor/frame";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * The frame of the rich text drawn without the editor's code: the bar, the
 * boxes, the spacing and the faces of the text, laid out as the editor lays
 * them out. The words go in its document, so they stay where the editor draws
 * them. This module holds no code of the editor, so a page can draw its words
 * before the editor loads.
 */
export function EditorPane({ children }: { children: ReactNode }) {
  return (
    <div className={editorFrame()}>
      <div aria-hidden className={editorBar()}>
        <div className={editorRow()} />
      </div>
      <ScrollArea className="flex-1">
        <div className={editorScroll()}>
          <div className={cn(editorPlaceholder(), editorDocument())} dir="auto">
            {children}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
