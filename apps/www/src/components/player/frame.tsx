import {
  ResizableHandle,
  ResizablePanel,
} from "@repo/design-system/components/ui/resizable";
import { cn } from "cn";
import type { ReactNode } from "react";
import {
  pageBoxVariants,
  pageGutterVariants,
  readingMeasureVariants,
} from "@/components/shared/content/width";
import {
  PaneStartProvider,
  PanesGroupProvider,
  SizedPane,
} from "@/components/shared/panes";

/**
 * The questions beside the navigator across the page's frame,
 * right under the player's one header row. From the large breakpoint the navigator is a pane that a
 * learner resizes by dragging the handle between the two; below it the handle
 * and the pane step aside and the navigator opens as a sheet. Unlike the shared
 * panes, whose panes scroll on their own, the page itself scrolls here, as the
 * questions' reading line and their reveal expect, so neither pane clips, and
 * the navigator's column sticks under the header. The questions keep a
 * readable measure in the middle of their pane.
 */
export function PlayerMain({
  children,
  navigator,
}: {
  children: ReactNode;
  navigator: ReactNode;
}) {
  return (
    <PanesGroupProvider
      className={cn(
        pageBoxVariants(),
        "h-auto! flex-1 overflow-visible! max-lg:[&>[data-separator]]:hidden! max-lg:[&>[data-separator]~[data-panel]]:hidden!"
      )}
      id="player"
    >
      <ResizablePanel
        className="overflow-visible!"
        id="questions"
        minSize="55%"
      >
        <div
          className={cn(
            readingMeasureVariants(),
            pageGutterVariants(),
            "min-w-0 py-6"
          )}
        >
          {children}
        </div>
      </ResizablePanel>
      {navigator === null ? null : (
        <>
          {/* The footer covers the divider, so the footer stays one row from edge to edge. */}
          <ResizableHandle
            className="z-0 items-start [&>div]:sticky [&>div]:top-[50svh]"
            withHandle
          />
          <PaneStartProvider size="25%">
            <SizedPane
              className="overflow-visible!"
              id="navigator"
              maxSize="40%"
              minSize="18%"
            >
              {navigator}
            </SizedPane>
          </PaneStartProvider>
        </>
      )}
    </PanesGroupProvider>
  );
}
