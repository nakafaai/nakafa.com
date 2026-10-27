import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/design-system/components/ui/resizable";
import type { ReactNode } from "react";
import { PlayerToolbar } from "@/components/player/toolbar";

/**
 * The toolbar row, then the questions beside the navigator across the app's
 * width (`max-w-7xl`). From the large breakpoint the navigator is a pane that a
 * learner resizes by dragging the handle between the two; below it the handle
 * and the pane step aside and the navigator opens as a sheet. Unlike the shared
 * panes, whose panes scroll on their own, the page itself scrolls here, as the
 * questions' reading line and their reveal expect, so neither pane clips, and
 * the navigator's column sticks under the toolbar. The questions keep a
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
    <>
      <PlayerToolbar />
      <ResizablePanelGroup
        className="overflow-visible! max-lg:[&>[data-separator]]:hidden! max-lg:[&>[data-separator]~[data-panel]]:hidden! mx-auto h-auto! max-w-7xl flex-1"
        orientation="horizontal"
      >
        <ResizablePanel
          className="[&>div]:overflow-visible!"
          id="questions"
          minSize="55%"
        >
          <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6 sm:px-6">
            {children}
          </div>
        </ResizablePanel>
        {navigator === null ? null : (
          <>
            <ResizableHandle
              className="items-start [&>div]:sticky [&>div]:top-[50svh]"
              withHandle
            />
            <ResizablePanel
              className="[&>div]:overflow-visible!"
              defaultSize="25%"
              id="navigator"
              maxSize="40%"
              minSize="18%"
            >
              {navigator}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </>
  );
}
