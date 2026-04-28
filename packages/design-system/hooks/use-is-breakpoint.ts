"use client";

import {
  createMaxWidthMediaQuery,
  createMinWidthMediaQuery,
  TAILWIND_BREAKPOINT_PIXELS,
} from "@repo/design-system/lib/breakpoints";
import { useEffect, useState } from "react";

type BreakpointMode = "min" | "max";

/**
 * Hook to detect whether the current viewport matches a given breakpoint rule.
 * Example:
 *   useIsBreakpoint("max", TAILWIND_BREAKPOINT_PIXELS.md)
 *   useIsBreakpoint("min", TAILWIND_BREAKPOINT_PIXELS.lg)
 */
export function useIsBreakpoint(
  mode: BreakpointMode = "max",
  breakpoint = TAILWIND_BREAKPOINT_PIXELS.md
) {
  const [matches, setMatches] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const query =
      mode === "min"
        ? createMinWidthMediaQuery(breakpoint)
        : createMaxWidthMediaQuery(breakpoint);

    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode, breakpoint]);

  return !!matches;
}
