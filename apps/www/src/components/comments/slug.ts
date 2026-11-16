import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";

/**
 * The slug whose comments the page shows. The deferred comments provide it above
 * their lazy list, so the list reads it without a prop.
 */
export const CommentsSlugContext = createContext<string | null>(null);

/** Reads the slug whose comments the list shows. */
export function useCommentsSlug() {
  return useRequired(CommentsSlugContext, "useCommentsSlug");
}
