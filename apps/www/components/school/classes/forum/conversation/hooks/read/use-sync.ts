import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useRef } from "react";

/** Marks the latest visible forum post as read without re-rendering on scroll. */
export function useReadSync({ forumId }: { forumId: Id<"schoolClassForums"> }) {
  const markForumRead = useMutation(
    api.classes.forums.mutations.readState.markForumRead
  );
  const lastMarkedPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(null);

  return (lastVisiblePostId: Id<"schoolClassForumPosts"> | null) => {
    if (!lastVisiblePostId) {
      return;
    }

    if (lastMarkedPostIdRef.current === lastVisiblePostId) {
      return;
    }

    lastMarkedPostIdRef.current = lastVisiblePostId;
    Effect.runFork(
      Effect.tryPromise({
        try: () =>
          markForumRead({
            forumId,
            lastReadPostId: lastVisiblePostId,
          }),
        catch: (cause) => cause,
      }).pipe(
        Effect.catchAll(() =>
          Effect.sync(() => {
            lastMarkedPostIdRef.current = null;
          })
        )
      )
    );
  };
}
