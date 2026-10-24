import type { ActiveOptions } from "@tanstack/react-router";

/**
 * The route that holds the locale of every page. It is the `from` of every app
 * link, so TanStack types the locale of a target of this tree as optional, and a
 * link that names no locale inherits the one of the page on screen. Targets are
 * plain modules, so they name it without loading the client link module.
 */
export const LOCALE_ROUTE = "/$locale";

/** The active rule of a link to one page: that page only, whatever its search. */
export const EXACT_ACTIVE_OPTIONS = {
  exact: true,
  includeSearch: false,
} satisfies ActiveOptions;
