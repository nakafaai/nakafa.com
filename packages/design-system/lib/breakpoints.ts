const TAILWIND_ROOT_FONT_SIZE = 16;

export const TAILWIND_BREAKPOINTS = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
};

export const TAILWIND_BREAKPOINT_PIXELS = {
  sm: 40 * TAILWIND_ROOT_FONT_SIZE,
  md: 48 * TAILWIND_ROOT_FONT_SIZE,
  lg: 64 * TAILWIND_ROOT_FONT_SIZE,
  xl: 80 * TAILWIND_ROOT_FONT_SIZE,
  "2xl": 96 * TAILWIND_ROOT_FONT_SIZE,
};

/**
 * Formats rem-based Tailwind tokens and pixel-based runtime breakpoints for
 * CSS media queries.
 */
function formatMediaBreakpoint(breakpoint: number | string) {
  if (typeof breakpoint === "number") {
    return `${breakpoint}px`;
  }

  return breakpoint;
}

/**
 * Builds a media query that matches Tailwind's `max-*` breakpoint semantics.
 */
export function createMaxWidthMediaQuery(breakpoint: number | string) {
  return `(width < ${formatMediaBreakpoint(breakpoint)})`;
}

/**
 * Builds an inclusive max-width query for explicit runtime cutoffs.
 */
export function createMaxWidthInclusiveMediaQuery(breakpoint: number | string) {
  return `(width <= ${formatMediaBreakpoint(breakpoint)})`;
}

/**
 * Builds a media query that matches Tailwind's `*:` breakpoint semantics.
 */
export function createMinWidthMediaQuery(breakpoint: number | string) {
  return `(width >= ${formatMediaBreakpoint(breakpoint)})`;
}

export const TAILWIND_MEDIA_QUERIES = {
  belowSm: createMaxWidthMediaQuery(TAILWIND_BREAKPOINTS.sm),
  smAndUp: createMinWidthMediaQuery(TAILWIND_BREAKPOINTS.sm),
  belowMd: createMaxWidthMediaQuery(TAILWIND_BREAKPOINTS.md),
  mdAndUp: createMinWidthMediaQuery(TAILWIND_BREAKPOINTS.md),
  belowLg: createMaxWidthMediaQuery(TAILWIND_BREAKPOINTS.lg),
  lgAndUp: createMinWidthMediaQuery(TAILWIND_BREAKPOINTS.lg),
  belowXl: createMaxWidthMediaQuery(TAILWIND_BREAKPOINTS.xl),
  xlAndUp: createMinWidthMediaQuery(TAILWIND_BREAKPOINTS.xl),
  below2Xl: createMaxWidthMediaQuery(TAILWIND_BREAKPOINTS["2xl"]),
  "2xlAndUp": createMinWidthMediaQuery(TAILWIND_BREAKPOINTS["2xl"]),
};
