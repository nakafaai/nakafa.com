import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ScrollToIndexOpts } from "virtua";
import type { ConversationRestoreTarget } from "@/components/school/classes/forum/conversation/data/scroll-snapshot";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";

type PendingPlacementAlign = NonNullable<ScrollToIndexOpts["align"]>;

export interface ConversationPendingPlacement {
  align?: PendingPlacementAlign;
  behavior?: ScrollBehavior;
  completion: "reached" | "settled";
  highlightPostId: Id<"schoolClassForumPosts"> | null;
  view: ConversationView;
}

export type ConversationRestorePlacement =
  | { kind: "none" }
  | { kind: "offset"; offset: number }
  | { kind: "placement"; placement: ConversationPendingPlacement };

/** Converts the initial restore target into the pending scroll operation. */
export function getConversationRestorePlacement(
  target: ConversationRestoreTarget | null
): ConversationRestorePlacement {
  if (!target) {
    return { kind: "none" };
  }

  if (target.kind === "offset") {
    return {
      kind: "offset",
      offset: target.offset,
    };
  }

  if (target.kind === "post") {
    return {
      kind: "placement",
      placement: {
        align: target.align,
        behavior: "auto",
        completion: "reached",
        highlightPostId: null,
        view: {
          kind: "post",
          postId: target.postId,
        },
      },
    };
  }

  return {
    kind: "placement",
    placement: {
      behavior: "auto",
      completion: "reached",
      highlightPostId: null,
      view: { kind: "bottom" },
    },
  };
}
