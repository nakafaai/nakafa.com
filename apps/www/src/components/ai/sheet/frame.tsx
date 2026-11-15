"use client";

import nina from "@repo/backend/confect/_generated/refs/nina";
import { Sheet, SheetContent } from "@repo/design-system/components/ui/sheet";
import { lazy } from "@repo/design-system/lib/lazy";
import { ClientOnly } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { Activity, Suspense, useRef, useState } from "react";
import { readChatArgs } from "@/components/ai/chat/access";
import { useAi } from "@/components/ai/context";
import { AiSheetHeader } from "@/components/ai/sheet/header";
import { Unauthenticated, UnlessSignedOut } from "@/components/auth/gate";
import { ConvexIsland } from "@/components/providers/island";

const SheetNew = lazy(() =>
  import("@/components/ai/sheet/new").then((module) => ({
    default: module.SheetNew,
  }))
);

const SheetConversation = lazy(() =>
  import("@/components/ai/sheet/conversation").then((module) => ({
    default: module.SheetConversation,
  }))
);

// The boundary holds the failure card, whose sign-in chain only a signed-out
// visitor who cannot read a chat needs. It loads with the body, so the shell's
// first JavaScript does not carry it on every page. Its own Suspense keeps the
// route on screen while the chunk loads.
const ChatBoundary = lazy(() =>
  import("@/components/ai/chat/boundary").then((module) => ({
    default: module.ChatBoundary,
  }))
);

/**
 * Nina's resizable side sheet. The frame is part of the app shell and stays
 * mounted while closed, so a press opens it in the same frame. Its content
 * sits in a hidden Activity: once the reader shows intent, React renders the
 * body ahead of the press, without its effects, so a warmed sheet only has to
 * be revealed. A sheet opened cold shows its frame at once and its body when
 * the body's code arrives.
 */
export function AiSheet() {
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);
  const warmed = useAi((state) => state.warmed);
  const content = useRef<HTMLDivElement>(null);
  // True from the end of the opening slide to the end of the closing one, so
  // the content stays in the sheet while it slides out.
  const [settledOpen, setSettledOpen] = useState(false);

  /**
   * Opening lands in the composer that is showing, not on a header button. The
   * body holds two composers once a chat is open, and one of them is hidden.
   */
  function focusComposer() {
    return Option.getOrElse(
      Arr.findFirst(
        content.current?.querySelectorAll("textarea") ?? [],
        (composer) => composer.getClientRects().length > 0
      ),
      () => true
    );
  }

  return (
    <Sheet
      disablePointerDismissal
      modal={false}
      onOpenChange={setOpen}
      onOpenChangeComplete={setSettledOpen}
      open={open}
    >
      <SheetContent
        className="w-full max-w-none border-l-0 sm:border-l"
        initialFocus={focusComposer}
        keepMounted
        showCloseButton={false}
        widthKey="nakafa-resize-nina"
      >
        <Activity mode={open || settledOpen ? "visible" : "hidden"}>
          <AiSheetHeader />
          <div className="flex min-h-0 flex-1 flex-col" ref={content}>
            {warmed ? <SheetBody /> : null}
          </div>
        </Activity>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The new-chat body, or the open chat once the learner has one. A chat that
 * could not open shows its failure card, and the learner picks another chat or
 * starts a new one. Each chat gets a boundary of its own, because `resetKeys`
 * cannot reset this one: a boundary reads them in `componentDidUpdate`, and
 * React runs no `componentDidUpdate` in an update that hides its Activity,
 * which is the update that forgets the chat. The boundary kept its error, and
 * the sheet showed nothing for every chat after it.
 */
function SheetBody() {
  const activeChatId = useAi((state) => state.activeChatId);
  // The open chat is read as SheetConversation reads it, with no share token.
  const read = activeChatId
    ? {
        args: readChatArgs(activeChatId, undefined),
        ref: nina.conversation.get,
      }
    : undefined;

  return (
    <>
      <Activity mode={activeChatId ? "hidden" : "visible"}>
        <Suspense fallback={null}>
          <ClientOnly fallback={null}>
            <SheetNew />
          </ClientOnly>
        </Suspense>
      </Activity>
      <Activity mode={activeChatId ? "visible" : "hidden"}>
        <ConvexIsland>
          <Suspense fallback={null}>
            <ChatBoundary key={activeChatId} read={read}>
              <UnlessSignedOut>
                {!!activeChatId && (
                  <Suspense fallback={null}>
                    <ClientOnly fallback={null}>
                      <SheetConversation chatId={activeChatId} />
                    </ClientOnly>
                  </Suspense>
                )}
              </UnlessSignedOut>
              <Unauthenticated>
                <Suspense fallback={null}>
                  <ClientOnly fallback={null}>
                    <SheetNew />
                  </ClientOnly>
                </Suspense>
              </Unauthenticated>
            </ChatBoundary>
          </Suspense>
        </ConvexIsland>
      </Activity>
    </>
  );
}
