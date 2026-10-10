"use client";

import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Sheet, SheetContent } from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "cn";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Activity, useRef } from "react";
import { useAi } from "@/components/ai/context";
import { AiSheetHeader } from "@/components/ai/sheet/header";
import { Authenticated, Unauthenticated } from "@/components/auth/gate";

const MIN_WIDTH = 384;
const MAX_WIDTH = 672;

const SheetNew = dynamic(
  () => import("@/components/ai/sheet/new").then((module) => module.SheetNew),
  { loading: () => null, ssr: false }
);

const SheetConversation = dynamic(
  () =>
    import("@/components/ai/sheet/conversation").then(
      (module) => module.SheetConversation
    ),
  { loading: () => null, ssr: false }
);

/**
 * Nina's resizable side sheet. The frame is part of the app shell and stays
 * mounted while closed, so a press opens it in the same frame. Its content
 * sits in a hidden Activity: once the reader shows intent, React renders the
 * body ahead of the press, without its effects, and opening only reveals it.
 */
export function AiSheet() {
  const t = useTranslations("Ai");
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);
  const warmed = useAi((state) => state.warmed);
  const content = useRef<HTMLDivElement>(null);

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

  /** Opening lands in the composer when it is there, not on a header button. */
  function focusComposer() {
    return content.current?.querySelector("textarea") ?? true;
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
        initialFocus={focusComposer}
        keepMounted
        showCloseButton={false}
        style={{ "--nina-width": `${width}px` }}
      >
        <Activity mode={open ? "visible" : "hidden"}>
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
          <div className="flex min-h-0 flex-1 flex-col" ref={content}>
            {warmed ? <SheetBody /> : null}
          </div>
        </Activity>
      </SheetContent>
    </Sheet>
  );
}

/** The new-chat body, or the open chat once the learner has one. */
function SheetBody() {
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);

  /** Returns the sheet to a new-chat state after private-chat failures. */
  function handlePrivateChatError() {
    setActiveChatId(null);
  }

  return (
    <>
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
    </>
  );
}

/** Keeps private-chat errors visually empty while the sheet resets. */
function SheetError() {
  return null;
}
