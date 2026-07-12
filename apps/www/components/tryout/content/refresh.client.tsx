"use client";

import { useRouter } from "@repo/internationalization/src/navigation";
import { useEffect, useRef } from "react";

/** Refreshes one stale prefetched route once Convex publishes review access. */
export function TryoutReviewRefresh() {
  const router = useRouter();
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (hasRefreshed.current) {
      return;
    }

    hasRefreshed.current = true;
    router.refresh();
  }, [router]);

  return null;
}
