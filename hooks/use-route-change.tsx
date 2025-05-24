"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Hook to detect route changes in Next.js App Router
 * Fires a callback when the route changes
 */
export function useRouteChange(callback: () => void) {
  const pathname = usePathname();
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Track previous values
  const prevPathname = useRef(pathname);

  useEffect(() => {
    // Check if pathname or search params changed
    if (pathname !== prevPathname.current) {
      // Only call callback if this is not the initial render
      if (prevPathname.current !== undefined) {
        callbackRef.current();
      }

      // Update refs
      prevPathname.current = pathname;
    }
  }, [pathname]);
}
