"use client";

import { usePrevious } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useEffectEvent, useLayoutEffect, useRef } from "react";
import type { ConversationTranscriptRuntime } from "@/components/school/classes/forum/conversation/hooks/transcript/use-virtualizer";
import type {
  ConversationTranscriptCommand,
  ConversationTranscriptCommandResult,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";
import { createInitialConversationView } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

interface LifecycleOptions {
  cancelPendingMarkRead: () => void;
  command: ConversationTranscriptCommand | null;
  flushMarkRead: (
    lastReadPostId: Id<"schoolClassForumPosts"> | undefined
  ) => void;
  handleCommandResult: (result: ConversationTranscriptCommandResult) => void;
  isAtLatestEdge: boolean;
  isLoadingOlder: boolean;
  items: VirtualItem[];
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  latestConversationView: ForumConversationView | null;
  mode: ForumConversationMode;
  runtime: ConversationTranscriptRuntime;
  timelineSessionVersion: number;
  unreadPostId: Id<"schoolClassForumPosts"> | null;
}

/** Owns transcript session restore, explicit commands, prepend correction, and unmount persistence. */
export function useTranscriptLifecycle({
  cancelPendingMarkRead,
  command,
  flushMarkRead,
  handleCommandResult,
  isAtLatestEdge,
  isLoadingOlder,
  items,
  lastPostId,
  latestConversationView,
  mode,
  runtime,
  timelineSessionVersion,
  unreadPostId,
}: LifecycleOptions) {
  const previousLastPostId = usePrevious(lastPostId);
  const handledCommandIdRef = useRef<number | null>(null);
  const previousTimelineSessionVersionRef = useRef(timelineSessionVersion);
  const restoredTimelineSessionRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (previousTimelineSessionVersionRef.current === timelineSessionVersion) {
      return;
    }

    previousTimelineSessionVersionRef.current = timelineSessionVersion;
    handledCommandIdRef.current = null;
    restoredTimelineSessionRef.current = null;
    runtime.resetSessionState();
  }, [runtime, timelineSessionVersion]);

  useLayoutEffect(() => {
    if (restoredTimelineSessionRef.current === timelineSessionVersion) {
      return;
    }

    if (items.length === 0) {
      return;
    }

    const nextView = createInitialConversationView({
      existingView: latestConversationView,
      mode,
      preferBottom: command?.kind === "latest",
      unreadPostId,
    });

    restoredTimelineSessionRef.current = timelineSessionVersion;
    runtime.latestViewRef.current = nextView;

    if (nextView.kind === "bottom") {
      runtime.pendingBottomPersistenceRef.current = true;
      runtime.pendingBottomPinRef.current = true;
      runtime.scrollToBottom("auto");
      return;
    }

    const align = mode.kind === "jump" ? "center" : "start";

    if (
      !runtime.scrollToView({
        align,
        behavior: "auto",
        view: nextView,
      })
    ) {
      restoredTimelineSessionRef.current = null;
      return;
    }
  }, [
    command?.kind,
    items.length,
    latestConversationView,
    mode,
    runtime,
    timelineSessionVersion,
    unreadPostId,
  ]);

  useLayoutEffect(() => {
    if (!command) {
      return;
    }

    if (handledCommandIdRef.current === command.id) {
      return;
    }

    if (command.kind === "latest") {
      if (!isAtLatestEdge) {
        return;
      }

      handledCommandIdRef.current = command.id;
      runtime.pendingBottomPersistenceRef.current = true;
      runtime.pendingBottomPinRef.current = true;
      runtime.scrollToBottom(command.smooth ? "smooth" : "auto");
      handleCommandResult({
        id: command.id,
        status: "scrolled",
      });
      return;
    }

    if (command.kind === "jump") {
      handledCommandIdRef.current = command.id;
      const nextView = {
        kind: "post",
        offset: 0,
        postId: command.postId,
      } as const;

      if (
        !runtime.scrollToView({
          align: "center",
          behavior: command.smooth ? "smooth" : "auto",
          view: nextView,
        })
      ) {
        handleCommandResult({
          id: command.id,
          status: "missing",
        });
        return;
      }

      runtime.latestViewRef.current = nextView;
      runtime.highlightVisiblePost(command.postId);
      handleCommandResult({
        id: command.id,
        status: "scrolled",
      });
      return;
    }

    handledCommandIdRef.current = command.id;

    if (
      !runtime.scrollToView({
        align: "start",
        behavior: "auto",
        view: command.view,
      })
    ) {
      handleCommandResult({
        id: command.id,
        status: "missing",
      });
      return;
    }

    runtime.latestViewRef.current = command.view;
    handleCommandResult({
      id: command.id,
      status: "scrolled",
    });
  }, [command, handleCommandResult, isAtLatestEdge, runtime]);

  useLayoutEffect(() => {
    const pendingOlderAnchor = runtime.pendingOlderAnchorRef.current;

    if (!pendingOlderAnchor || isLoadingOlder) {
      return;
    }

    runtime.pendingOlderAnchorRef.current = null;
    const restoredOffset = runtime.getScrollOffsetForView({
      align: "start",
      view: {
        kind: "post",
        offset: pendingOlderAnchor.offset,
        postId: pendingOlderAnchor.postId,
      },
    });

    if (restoredOffset === null) {
      return;
    }

    runtime.virtualizer.scrollToOffset(restoredOffset, { behavior: "auto" });
    runtime.previousScrollOffsetRef.current = restoredOffset;
  }, [isLoadingOlder, runtime]);

  useLayoutEffect(() => {
    if (
      !(
        isAtLatestEdge &&
        lastPostId &&
        previousLastPostId &&
        lastPostId !== previousLastPostId
      )
    ) {
      return;
    }

    if (
      runtime.isBottomPinnedRef.current ||
      runtime.pendingBottomPinRef.current
    ) {
      runtime.pendingBottomPersistenceRef.current = true;
      runtime.scrollToBottom("auto");
    }

    if (runtime.isAtTranscriptBottom()) {
      flushMarkRead(lastPostId);
    }
  }, [flushMarkRead, isAtLatestEdge, lastPostId, previousLastPostId, runtime]);

  const handleTranscriptUnmount = useEffectEvent(() => {
    runtime.handleScrollSettled.cancel();
    cancelPendingMarkRead();
    const latestView =
      runtime.captureCurrentConversationView() ?? runtime.latestViewRef.current;

    if (latestView) {
      runtime.reportSettled(latestView);
    }
  });

  useLayoutEffect(
    () => () => {
      handleTranscriptUnmount();
    },
    []
  );
}
