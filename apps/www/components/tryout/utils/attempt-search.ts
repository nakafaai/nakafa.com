import { createLoader, parseAsString } from "nuqs/server";

export const tryoutSearchParsers = {
  attempt: parseAsString,
};

/** Loads the feature-local tryout search params used by set and part routes. */
export const loadTryoutSearchParams = createLoader(tryoutSearchParsers);
