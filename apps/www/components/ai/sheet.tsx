"use client";

import { useMediaQuery } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Sheet, SheetContent } from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "@repo/design-system/lib/utils";
import { Authenticated, Unauthenticated } from "convex/react";
import { Activity, memo } from "react";
import { useAi } from "@/components/ai/context/use-ai";
import { CurrentChatProvider } from "@/components/ai/context/use-current-chat";
import { AiSheetHeader } from "@/components/ai/sheet-header";
import { SheetMain } from "@/components/ai/sheet-main";
import { SheetNew } from "@/components/ai/sheet-new";

const MIN_WIDTH = 384;
const MAX_WIDTH = 672;

/** Renders Nina's resizable side sheet shell. */
export function AiSheet() {
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const { width, isResizing, resizerProps, setWidth } = useResizable({
    initialWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    minWidth: MIN_WIDTH,
  });
  const expanded = width === MAX_WIDTH;

  /** Toggles Nina sheet between compact and expanded widths. */
  function handleResizeToggle() {
    setWidth(expanded ? MIN_WIDTH : MAX_WIDTH);
  }

  /** Returns the sheet to a new-chat state after private-chat failures. */
  function handlePrivateChatError() {
    setActiveChatId(null);
  }

  return (
    <Sheet
      disablePointerDismissal
      modal={false}
      onOpenChange={setOpen}
      open={open}
    >
      <SheetContent
        className={cn(
          "max-w-none gap-0 border-l-0 sm:max-w-none sm:border-l",
          !!isResizing && "transition-none"
        )}
        showCloseButton={false}
        style={{ width: isMobile ? "100%" : `${width}px` }}
      >
        <button
          className={cn(
            "absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize outline-0 ring-0 transition-colors hover:bg-accent",
            !!isResizing && "bg-accent",
            !!isMobile && "hidden"
          )}
          onKeyDown={resizerProps.onKeyDown}
          onMouseDown={resizerProps.onMouseDown}
          type="button"
        />
        <AiSheetHeader
          expanded={expanded}
          onResizeToggle={handleResizeToggle}
        />

        <Activity mode={activeChatId ? "hidden" : "visible"}>
          <SheetNew />
        </Activity>
        <Activity mode={activeChatId ? "visible" : "hidden"}>
          <ErrorBoundary
            fallback={<SheetError />}
            onError={handlePrivateChatError}
          >
            <Authenticated>
              {!!activeChatId && (
                <CurrentChatProvider chatId={activeChatId}>
                  <SheetMain />
                </CurrentChatProvider>
              )}
            </Authenticated>
            <Unauthenticated>
              <SheetNew />
            </Unauthenticated>
          </ErrorBoundary>
        </Activity>
      </SheetContent>
    </Sheet>
  );
}

/** Keeps private-chat errors visually empty while the sheet resets. */
const SheetError = memo(() => null);
