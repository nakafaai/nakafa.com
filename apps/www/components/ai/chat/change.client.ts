"use client";

import { useTransition } from "react";

/**
 * Runs the changes a learner makes to a chat, such as renaming, sharing or
 * deleting it. A change starts at once, outside the transition: Convex shows
 * the optimistic result through a state update, and an update made inside a
 * transition waits until the transition ends, which is when the server has
 * answered. The transition only holds `isPending` until the change settles.
 */
export function useChange() {
  const [isPending, startTransition] = useTransition();

  /** Starts the change now, and keeps `isPending` true until what it returns settles. */
  function change(start: () => Promise<void>) {
    const settling = start();
    startTransition(() => settling);
  }

  return { change, isPending };
}
