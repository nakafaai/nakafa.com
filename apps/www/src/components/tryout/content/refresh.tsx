"use client";

import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/** Refreshes one stale prefetched route once Convex publishes content access. */
export function TryoutContentRefresh() {
  const router = useRouter();
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (hasRefreshed.current) {
      return;
    }

    hasRefreshed.current = true;
    router.invalidate();
  }, [router]);

  return null;
}
