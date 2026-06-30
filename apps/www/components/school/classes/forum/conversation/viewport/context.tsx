import { useReducedMotion } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Effect, Fiber, Stream } from "effect";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
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

  activeTranscriptRef.current = activeTranscript;
  savedSnapshotRef.current = savedSnapshot;
  unreadCueRef.current = unreadCue;

  const dispatch = useCallback((event: ViewportEvent) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    Effect.runFork(viewport.dispatch(event));
  }, []);

  const measure = useCallback(
    (source: "frame" | "scroll") => {
      dispatch({
        measurement: scrollerRef.current?.measure() ?? null,
        source,
        type: "measure",
      });
    },
    [dispatch]
  );

  const requestMeasureFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      measure("frame");
    });
  }, [measure]);

  useEffect(() => {
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
        activeTranscript: activeTranscriptRef.current,
        savedSnapshot: savedSnapshotRef.current,
        type: "transcript",
        unreadCue: unreadCueRef.current,
      })
    );
    requestMeasureFrame();

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      scrollerRef.current = null;
      viewportRef.current = null;
      Effect.runFork(
        Fiber.interrupt(stateFiber).pipe(Effect.zipRight(viewport.shutdown))
      );
    };
  }, [
    forumId,
    markForumRead,
    prefersReducedMotion,
    requestMeasureFrame,
    saveConversationScrollSnapshot,
  ]);

  useEffect(() => {
    dispatch({
      activeTranscript,
      savedSnapshot,
      type: "transcript",
      unreadCue,
    });
    requestMeasureFrame();
  }, [
    activeTranscript,
    dispatch,
    requestMeasureFrame,
    savedSnapshot,
    unreadCue,
  ]);

  useEffect(() => {
    const persist = () => {
      dispatch({ type: "persist" });
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
  }, [dispatch]);

  const actions = useMemo(
    () =>
      ({
        acknowledgeUnreadCue,
        flushSnapshot: () => dispatch({ type: "persist" }),
        goBack: () => {
          dispatch({ type: "back" });
          requestMeasureFrame();
        },
        goToLatest: () => {
          dispatch({ type: "latest" });
          requestMeasureFrame();
        },
        goToPost: (postId) => {
          dispatch({ postId, type: "post" });
          requestMeasureFrame();
        },
        handleScroll: () => {
          measure("scroll");
        },
        handleScrollEnd: () => {
          measure("frame");
        },
        setVirtualizerHandle: (handle) => {
          virtualizerHandleRef.current = handle;
          requestMeasureFrame();
        },
      }) satisfies ViewportActions,
    [acknowledgeUnreadCue, dispatch, measure, requestMeasureFrame]
  );
  const value = useMemo(
    () => ({
      actions,
      state,
    }),
    [actions, state]
  );

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
