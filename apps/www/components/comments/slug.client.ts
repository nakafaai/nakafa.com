"use client";

import { createContext, use } from "react";

/**
 * The slug whose comments the page shows. The deferred comments provide it above
 * their lazy list, so the list reads it without a prop.
 */
export const CommentsSlugContext = createContext<string | null>(null);

/** Reads the slug whose comments the list shows. */
export function useCommentsSlug() {
  const slug = use(CommentsSlugContext);
  if (slug === null) {
    throw new Error("useCommentsSlug must be used within DeferredComments");
  }
  return slug;
}
