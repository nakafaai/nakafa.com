"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Hook to detect route changes in Next.js App Router
 * Fires a callback when the route changes (including hash changes)
 */
export function useRouteChange(callback: () => void) {
  const pathname = usePathname();
  const callbackRef = useRef(callback);
  const prevPathnameRef = useRef(pathname);
  const prevHashRef = useRef<string>("");

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Track pathname changes
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      // Only call callback if this is not the initial render
      if (prevPathnameRef.current !== undefined) {
        callbackRef.current();
      }
      prevPathnameRef.current = pathname;
    }
  }, [pathname]);

  // Track hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash;
      if (currentHash !== prevHashRef.current) {
        callbackRef.current();
        prevHashRef.current = currentHash;
      }
    };

    // Set initial hash
    if (typeof window !== "undefined") {
      prevHashRef.current = window.location.hash;
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);
}
