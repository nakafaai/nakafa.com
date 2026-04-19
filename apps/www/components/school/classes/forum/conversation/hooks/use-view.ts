import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type RefObject, useCallback, useRef } from "react";
import type { ForumConversationView } from "@/lib/store/forum";

interface UseViewResult {
  latestConversationView: RefObject<ForumConversationView | null>;
  persistConversationView: (view?: ForumConversationView | null) => void;
}

/** Owns persisted conversation snapshots for the active forum transcript. */
export function useView({
  forumId,
  saveConversationView,
  savedConversationView,
}: {
  forumId: Id<"schoolClassForums">;
  saveConversationView: (
    forumId: Id<"schoolClassForums">,
    view: ForumConversationView
  ) => void;
  savedConversationView: ForumConversationView | null;
}): UseViewResult {
  const latestConversationView = useRef<ForumConversationView | null>(
    savedConversationView
  );

  /** Saves the latest conversation snapshot into the shared forum store. */
  const persistConversationView = useCallback(
    (view?: ForumConversationView | null) => {
      const nextView = view ?? latestConversationView.current;

      if (!nextView) {
        return;
      }

      latestConversationView.current = nextView;
      saveConversationView(forumId, nextView);
    },
    [forumId, saveConversationView]
  );

  return {
    latestConversationView,
    persistConversationView,
  };
}
