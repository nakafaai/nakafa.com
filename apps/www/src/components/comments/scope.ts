import { createContext, use } from "react";
import type { CommentRow, RowComment } from "@/components/comments/state";

/** The comment of the row around its parts: its text, its photos, its menu and its like. */
export const RowCommentContext = createContext<RowComment | null>(null);

/** Reads the comment of the surrounding row. */
export function useRowComment() {
  const comment = use(RowCommentContext);
  if (comment === null) {
    throw new Error("useRowComment must be used within CommentRow");
  }
  return comment;
}

/**
 * Where a list of comments stands: under a page, where a comment and its replies read as one thread with
 * no hairlines, or on a profile, whose rows each end with one.
 */
export const CommentsPlaceContext = createContext<"page" | "profile">(
  "profile"
);

/** The comment a composer below answers: a reply composer's target, and none for the list's own composer. */
export const ComposerAnswersContext = createContext<CommentRow | null>(null);
