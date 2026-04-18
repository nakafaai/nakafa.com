import type { Id } from "@repo/backend/convex/_generated/dataModel";

export interface ScrollCommand {
  align: "center" | "start";
  kind: "post";
  offset?: number;
  postId: Id<"schoolClassForumPosts">;
}

interface ResolvedScrollCommand {
  align: "center" | "start";
  index: number;
  kind: "post";
  offset?: number;
}

/** Resolves one reactive scroll command only when the viewport has enough data to execute it. */
export function resolveScrollCommand({
  command,
  postIdToIndex,
}: {
  command: ScrollCommand | null;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
}): ResolvedScrollCommand | null {
  if (!command) {
    return null;
  }

  const index = postIdToIndex.get(command.postId);

  if (index === undefined) {
    return null;
  }

  return {
    align: command.align,
    index,
    kind: "post",
    offset: command.offset,
  };
}

/** Returns whether one latest-edge command has actually landed at the live bottom. */
export function shouldPersistBottomConversationView({
  hasPendingBottomPersistence,
  isAtBottom,
  isAtLatestEdge,
  isInitialAnchorSettled,
}: {
  hasPendingBottomPersistence: boolean;
  isAtBottom: boolean;
  isAtLatestEdge: boolean;
  isInitialAnchorSettled: boolean;
}) {
  return (
    hasPendingBottomPersistence &&
    isInitialAnchorSettled &&
    isAtBottom &&
    isAtLatestEdge
  );
}
