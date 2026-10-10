"use client";

import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Sheet, SheetContent } from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "cn";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Activity } from "react";
import { useAi } from "@/components/ai/context";
import { AiSheetHeader } from "@/components/ai/sheet/header";
import {
  loadSheetConversation,
  loadSheetNew,
} from "@/components/ai/sheet/module";
import { Authenticated, Unauthenticated } from "@/components/auth/gate";

const MIN_WIDTH = 384;
const MAX_WIDTH = 672;

const SheetNew = dynamic(
  () => loadSheetNew().then((module) => module.SheetNew),
  { loading: () => null, ssr: false }
);

const SheetConversation = dynamic(
  () => loadSheetConversation().then((module) => module.SheetConversation),
  { loading: () => null, ssr: false }
);

/**
 * Nina's resizable side sheet. The frame and its header are part of the app
 * shell, so a press opens the sheet in the same frame. Only the body is
 * deferred: the new-chat body is small and warmed on intent, and the
 * conversation body loads when a chat opens.
 */
export function AiSheet() {
  const t = useTranslations("Ai");
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);

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
          "w-full max-w-none gap-0 border-l-0 sm:w-(--nina-width) sm:max-w-none sm:border-l",
          !!isResizing && "transition-none"
        )}
        showCloseButton={false}
        style={{ "--nina-width": `${width}px` }}
      >
        <button
          aria-label={t("resize")}
          className={cn(
            "absolute top-0 bottom-0 left-0 z-10 hidden w-1 cursor-col-resize outline-0 ring-0 transition-colors hover:bg-ring focus-visible:bg-ring sm:block",
            !!isResizing && "bg-ring"
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
              {!!activeChatId && <SheetConversation chatId={activeChatId} />}
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
function SheetError() {
  return null;
}
