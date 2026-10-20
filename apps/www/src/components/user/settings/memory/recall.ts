import { usePaginatedQuery, useQuery } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { useConvexAuth } from "@/components/providers/convex";
import {
  MEMORY_PAGE,
  type MemoryPage,
} from "@/components/user/settings/memory/list";
import { readingOf } from "@/components/user/settings/memory/reading";

/**
 * Asks Convex for the learner's memories and for whether memory is paused, and
 * hands the answers to `readingOf` with the moment the server read the page. It
 * must run once for the page, because the pages a learner loaded belong to the
 * hook that loaded them.
 */
export function useMemoryReading(
  first: MemoryPage,
  paused: boolean,
  now: number
) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const pages = usePaginatedQuery(
    nina.memory.list,
    isAuthenticated ? {} : "skip",
    { initialNumItems: MEMORY_PAGE }
  );
  const state = useQuery(nina.memory.state, isAuthenticated ? {} : "skip");

  return readingOf(pages, state, first, paused, now);
}
