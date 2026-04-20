import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useCallback, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { ConversationTranscriptCommand } from "@/components/school/classes/forum/conversation/types";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";
import { createInitialConversationView } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

type ScrollAlignment = "center" | "start";
type ScrollBehavior = "auto" | "smooth";

interface UseTranscriptCommandResult {
  resetCommand: () => void;
}

/** Owns explicit transcript commands and one session-scoped initial restore. */
export function useTranscriptCommand({
  armBottomPin,
  command,
  handleCommandResult,
  isAtLatestEdge,
  items,
  latestConversationView,
  mode,
  scrollToBottom,
  scrollToView,
  timelineSessionVersion,
  unreadPostId,
}: {
  armBottomPin: () => void;
  command: ConversationTranscriptCommand | null;
  handleCommandResult: (result: {
    id: number;
    status: "missing" | "scrolled";
  }) => void;
  isAtLatestEdge: boolean;
  items: unknown[];
  latestConversationView: ForumConversationView | null;
  mode: ForumConversationMode;
  scrollToBottom: (behavior: ScrollBehavior) => void;
  scrollToView: (options: {
    align: ScrollAlignment;
    behavior: ScrollBehavior;
    view: Extract<ForumConversationView, { kind: "post" }>;
  }) => boolean;
  timelineSessionVersion: number;
  unreadPostId: Id<"schoolClassForumPosts"> | null;
}): UseTranscriptCommandResult {
  const handledCommandIdRef = useRef<number | null>(null);
  const restoredTimelineSessionRef = useRef<number | null>(null);

  /** Clears handled command ids and initial restore bookkeeping for the next session. */
  const resetCommand = useCallback(() => {
    handledCommandIdRef.current = null;
    restoredTimelineSessionRef.current = null;
  }, []);

  /** Scrolls one semantic post into the transcript with the requested alignment and behavior. */
  const scrollToPostView = useCallback(
    ({
      align,
      behavior,
      postId,
    }: {
      align: ScrollAlignment;
      behavior: ScrollBehavior;
      postId: Id<"schoolClassForumPosts">;
    }) =>
      scrollToView({
        align,
        behavior,
        view: {
          kind: "post",
          offset: 0,
          postId,
        },
      }),
    [scrollToView]
  );

  /** Executes one explicit command emitted by the conversation intent layer. */
  const runCommand = useEffectEvent(
    (nextCommand: ConversationTranscriptCommand) => {
      if (handledCommandIdRef.current === nextCommand.id) {
        return;
      }

      if (nextCommand.kind === "latest") {
        if (!isAtLatestEdge) {
          return;
        }

        handledCommandIdRef.current = nextCommand.id;
        armBottomPin();
        scrollToBottom(nextCommand.smooth ? "smooth" : "auto");
        handleCommandResult({
          id: nextCommand.id,
          status: "scrolled",
        });
        return;
      }

      if (nextCommand.kind === "jump") {
        handledCommandIdRef.current = nextCommand.id;
        const didScroll = scrollToPostView({
          align: "center",
          behavior: nextCommand.smooth ? "smooth" : "auto",
          postId: nextCommand.postId,
        });

        handleCommandResult({
          id: nextCommand.id,
          status: didScroll ? "scrolled" : "missing",
        });
        return;
      }

      handledCommandIdRef.current = nextCommand.id;
      const didRestore = scrollToView({
        align: "start",
        behavior: "auto",
        view: nextCommand.view,
      });

      handleCommandResult({
        id: nextCommand.id,
        status: didRestore ? "scrolled" : "missing",
      });
    }
  );

  useLayoutEffect(() => {
    if (items.length === 0) {
      return;
    }

    if (restoredTimelineSessionRef.current === timelineSessionVersion) {
      return;
    }

    const nextView = createInitialConversationView({
      existingView: latestConversationView,
      mode,
      preferBottom: command?.kind === "latest",
      unreadPostId,
    });

    restoredTimelineSessionRef.current = timelineSessionVersion;

    if (nextView.kind === "bottom") {
      armBottomPin();
      scrollToBottom("auto");
      return;
    }

    const didRestore =
      mode.kind === "jump"
        ? scrollToPostView({
            align: "center",
            behavior: "auto",
            postId: nextView.postId,
          })
        : scrollToView({
            align: "start",
            behavior: "auto",
            view: nextView,
          });

    if (!didRestore) {
      restoredTimelineSessionRef.current = null;
    }
  }, [
    armBottomPin,
    command?.kind,
    items,
    latestConversationView,
    mode,
    scrollToBottom,
    scrollToPostView,
    scrollToView,
    timelineSessionVersion,
    unreadPostId,
  ]);

  useLayoutEffect(() => {
    if (!command) {
      return;
    }

    runCommand(command);
  }, [command]);

  return {
    resetCommand,
  };
}
