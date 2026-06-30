import { useReducedMotion } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Effect, Fiber, Stream } from "effect";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";
import type { VirtualizerHandle } from "virtua";
import { useForumSession } from "@/components/school/classes/forum/context/use-session";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import type { ConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/transcript/unread";
import {
  type BrowserViewportScroller,
  createBrowserViewportAdapters,
} from "@/components/school/classes/forum/conversation/viewport/browser";
import {
  initialViewportState,
  type ViewportEvent,
  type ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";
import {
  type ConversationViewport,
  makeConversationViewport,
} from "@/components/school/classes/forum/conversation/viewport/module";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

interface ViewportActions {
  acknowledgeUnreadCue: () => void;
  flushSnapshot: () => void;
  goBack: () => void;
  goToLatest: () => void;
  goToPost: (postId: Id<"schoolClassForumPosts">) => void;
  handleScroll: () => void;
  handleScrollEnd: () => void;
  setVirtualizerHandle: (handle: VirtualizerHandle | null) => void;
}

interface ViewportContextValue {
  actions: ViewportActions;
  state: ViewportState;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

/** Sends one event into the current Viewport Module instance. */
function dispatchViewportEvent(
  viewportRef: RefObject<ConversationViewport | null>,
  event: ViewportEvent
) {
  const viewport = viewportRef.current;

  if (!viewport) {
    return;
  }

  Effect.runFork(viewport.dispatch(event));
}

/** Measures the current scroller and forwards the result to the Viewport Module. */
function measureViewport(
  scrollerRef: RefObject<BrowserViewportScroller | null>,
  viewportRef: RefObject<ConversationViewport | null>,
  source: "frame" | "scroll"
) {
  dispatchViewportEvent(viewportRef, {
    measurement: scrollerRef.current?.measure() ?? null,
    source,
    type: "measure",
  });
}

/** Schedules one animation-frame measurement for Virtua layout changes. */
function requestViewportMeasureFrame({
  frameRef,
  scrollerRef,
  viewportRef,
}: {
  frameRef: RefObject<number | null>;
  scrollerRef: RefObject<BrowserViewportScroller | null>;
  viewportRef: RefObject<ConversationViewport | null>;
}) {
  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current);
  }

  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = null;
    measureViewport(scrollerRef, viewportRef, "frame");
  });
}

/** Cancels any pending animation-frame measurement. */
function cancelViewportMeasureFrame(frameRef: RefObject<number | null>) {
  if (frameRef.current === null) {
    return;
  }

  cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
}

/** Provides the React Interface for one Effect-owned Forum Conversation Viewport. */
export function ConversationViewportProvider({
  acknowledgeUnreadCue,
  activeTranscript,
  children,
  forumId,
  savedSnapshot,
  unreadCue,
}: {
  acknowledgeUnreadCue: () => void;
  activeTranscript: ActiveTranscriptModel;
  children: ReactNode;
  forumId: Id<"schoolClassForums">;
  savedSnapshot: ConversationScrollSnapshot | null;
  unreadCue: ConversationUnreadCue | null;
}) {
  const saveConversationScrollSnapshot = useForumSession(
    (state) => state.saveConversationScrollSnapshot
  );
  const markForumRead = useMutation(
    api.classes.forums.mutations.readState.markForumRead
  );
  const prefersReducedMotion = useReducedMotion();
  const activeTranscriptRef = useRef(activeTranscript);
  const frameRef = useRef<number | null>(null);
  const savedSnapshotRef = useRef(savedSnapshot);
  const scrollerRef = useRef<BrowserViewportScroller | null>(null);
  const unreadCueRef = useRef(unreadCue);
  const virtualizerHandleRef = useRef<VirtualizerHandle | null>(null);
  const viewportRef = useRef<ConversationViewport | null>(null);
  const [state, setState] = useState(initialViewportState);
  const getOpeningTranscript = useEffectEvent(() => ({
    activeTranscript,
    savedSnapshot,
    unreadCue,
  }));

  useEffect(() => {
    const {
      activeTranscript: openingTranscript,
      savedSnapshot: openingSavedSnapshot,
      unreadCue: openingUnreadCue,
    } = getOpeningTranscript();
    activeTranscriptRef.current = openingTranscript;
    savedSnapshotRef.current = openingSavedSnapshot;
    unreadCueRef.current = openingUnreadCue;

    const { adapters, scroller } = createBrowserViewportAdapters({
      forumId,
      getHandle: () => virtualizerHandleRef.current,
      getTranscript: () => activeTranscriptRef.current,
      markForumRead,
      prefersReducedMotion: prefersReducedMotion === true,
      saveSnapshot: saveConversationScrollSnapshot,
    });
    const viewport = Effect.runSync(makeConversationViewport(adapters));
    const stateFiber = Effect.runFork(
      Stream.runForEach(viewport.changes, (nextState) =>
        Effect.sync(() => {
          setState(nextState);
        })
      )
    );

    scrollerRef.current = scroller;
    viewportRef.current = viewport;

    Effect.runFork(
      viewport.dispatch({
        activeTranscript: openingTranscript,
        savedSnapshot: openingSavedSnapshot,
        type: "transcript",
        unreadCue: openingUnreadCue,
      })
    );
    requestViewportMeasureFrame({ frameRef, scrollerRef, viewportRef });

    return () => {
      cancelViewportMeasureFrame(frameRef);

      const currentViewport = viewportRef.current;
      scrollerRef.current = null;
      viewportRef.current = null;

      if (!currentViewport) {
        Effect.runFork(Fiber.interrupt(stateFiber));
        return;
      }

      Effect.runFork(
        currentViewport.flushSnapshot.pipe(
          Effect.zipRight(Fiber.interrupt(stateFiber)),
          Effect.zipRight(currentViewport.shutdown)
        )
      );
    };
  }, [
    forumId,
    markForumRead,
    prefersReducedMotion,
    saveConversationScrollSnapshot,
  ]);

  useEffect(() => {
    activeTranscriptRef.current = activeTranscript;
    savedSnapshotRef.current = savedSnapshot;
    unreadCueRef.current = unreadCue;

    dispatchViewportEvent(viewportRef, {
      activeTranscript,
      savedSnapshot,
      type: "transcript",
      unreadCue,
    });
    requestViewportMeasureFrame({ frameRef, scrollerRef, viewportRef });
  }, [activeTranscript, savedSnapshot, unreadCue]);

  useEffect(() => {
    const persist = () => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      Effect.runFork(viewport.flushSnapshot);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persist();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", persist);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, []);

  const actions = {
    acknowledgeUnreadCue,
    flushSnapshot: () => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      Effect.runFork(viewport.flushSnapshot);
    },
    goBack: () => {
      dispatchViewportEvent(viewportRef, { type: "back" });
      requestViewportMeasureFrame({ frameRef, scrollerRef, viewportRef });
    },
    goToLatest: () => {
      dispatchViewportEvent(viewportRef, { type: "latest" });
      requestViewportMeasureFrame({ frameRef, scrollerRef, viewportRef });
    },
    goToPost: (postId) => {
      dispatchViewportEvent(viewportRef, { postId, type: "post" });
      requestViewportMeasureFrame({ frameRef, scrollerRef, viewportRef });
    },
    handleScroll: () => {
      measureViewport(scrollerRef, viewportRef, "scroll");
    },
    handleScrollEnd: () => {
      measureViewport(scrollerRef, viewportRef, "frame");
    },
    setVirtualizerHandle: (handle) => {
      virtualizerHandleRef.current = handle;
      requestViewportMeasureFrame({ frameRef, scrollerRef, viewportRef });
    },
  } satisfies ViewportActions;
  const value = {
    actions,
    state,
  };

  return (
    <ViewportContext.Provider value={value}>
      {children}
    </ViewportContext.Provider>
  );
}

/** Reads one selected state slice from the Effect-owned Viewport Interface. */
export function useViewport<T>(selector: (state: ViewportState) => T) {
  const value = useContextSelector(ViewportContext, (context) => context);

  if (!value) {
    throw new Error("useViewport must be used within a ConversationProvider");
  }

  return selector(value.state);
}

/** Reads the semantic actions exposed by the Effect-owned Viewport Interface. */
export function useControls() {
  const actions = useContextSelector(
    ViewportContext,
    (context) => context?.actions
  );

  if (!actions) {
    throw new Error("useControls must be used within a ConversationProvider");
  }

  return actions;
}
