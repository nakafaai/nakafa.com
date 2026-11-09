import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";

/** The question a comment's menu opened, if any: its deletion for its learner, a report for anyone else. */
export type CommentDialog = "delete" | "report" | null;

/** Which question of the surrounding comment menu is open, and how to open or close it. */
export const CommentDialogContext = createContext<{
  readonly dialog: CommentDialog;
  readonly setDialog: (dialog: CommentDialog) => void;
} | null>(null);

/** Reads whether one question of the surrounding menu is open, and closes it. */
export function useCommentDialog(name: Exclude<CommentDialog, null>) {
  const context = useRequired(CommentDialogContext, "useCommentDialog");
  return {
    onOpenChange: (open: boolean) => context.setDialog(open ? name : null),
    open: context.dialog === name,
  };
}
