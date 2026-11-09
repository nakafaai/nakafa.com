import { createContext, use } from "react";

/** The question a comment's menu opened, if any: its deletion for its learner, a report for anyone else. */
export type CommentDialog = "delete" | "report" | null;

/** Which question of the surrounding comment menu is open, and how to open or close it. */
export const CommentDialogContext = createContext<{
  readonly dialog: CommentDialog;
  readonly setDialog: (dialog: CommentDialog) => void;
} | null>(null);

/** Reads whether one question of the surrounding menu is open, and closes it. */
export function useCommentDialog(name: Exclude<CommentDialog, null>) {
  const context = use(CommentDialogContext);
  if (context === null) {
    // A question outside its menu is a composition error at this seam.
    throw new Error("A comment's question renders inside its CommentMenu.");
  }
  return {
    onOpenChange: (open: boolean) => context.setDialog(open ? name : null),
    open: context.dialog === name,
  };
}
