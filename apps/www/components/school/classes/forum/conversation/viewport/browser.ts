import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import type refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

import { Duration, Effect } from "effect";
import type { VirtualizerHandle } from "virtua";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  type ViewportAdapters,
  ViewportReadError,
  ViewportSessionError,
} from "@/components/school/classes/forum/conversation/viewport/adapter";
import { createViewportScroller } from "@/components/school/classes/forum/conversation/viewport/scroller";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

export type BrowserViewportScroller = ReturnType<typeof createViewportScroller>;

type MarkForumReadMutation = (
  args: Ref.Args<
    typeof refs.public.classes.forums.mutations.readState.markForumRead
  >
) => InvokeReturn<
  typeof refs.public.classes.forums.mutations.readState.markForumRead
>;

interface BrowserViewportAdaptersInput {
  forumId: Id<"schoolClassForums">;
  /** Returns the mounted Virtua handle when the transcript is rendered. */
  getHandle: () => VirtualizerHandle | null;
  /** Returns the latest active transcript model held by the React boundary. */
  getTranscript: () => ActiveTranscriptModel;
  /** Convex mutation boundary for marking the visible post as read. */
  markForumRead: MarkForumReadMutation;
  prefersReducedMotion: boolean;
  /** Session-store boundary for saving the semantic scroll snapshot. */
  saveSnapshot: (
    forumId: Id<"schoolClassForums">,
    snapshot: ConversationScrollSnapshot
  ) => void;
}

/** Creates the browser-backed Effect adapters for one live Conversation viewport. */
export function createBrowserViewportAdapters({
  forumId,
  getHandle,
  getTranscript,
  markForumRead,
  prefersReducedMotion,
  saveSnapshot,
}: BrowserViewportAdaptersInput) {
  const scroller = createViewportScroller({
    getHandle,
    getTranscript,
    prefersReducedMotion,
  });
  const adapters = {
    read: {
      markPostRead: (postId) =>
        Effect.tryPromise({
          try: () => markForumRead({ forumId, lastReadPostId: postId }),
          catch: (cause) =>
            new ViewportReadError({
              cause,
              message: "Failed to mark forum post as read.",
            }),
        }).pipe(
          Effect.flatMap((result) =>
            Effect.fromResult(result).pipe(
              Effect.mapError(
                (cause) =>
                  new ViewportReadError({
                    cause,
                    message: "Failed to mark forum post as read.",
                  })
              )
            )
          ),
          Effect.asVoid
        ),
    },
    scroller,
    session: {
      saveSnapshot: (snapshot) =>
        Effect.try({
          try: () => saveSnapshot(forumId, snapshot),
          catch: (cause) =>
            new ViewportSessionError({
              cause,
              message: "Failed to save forum conversation snapshot.",
            }),
        }),
    },
    timer: {
      sleep: (milliseconds) => Effect.sleep(Duration.millis(milliseconds)),
    },
  } satisfies ViewportAdapters;

  return { adapters, scroller };
}
