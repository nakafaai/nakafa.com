import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";

/**
 * The query a learner makes of a track's sets: the direction, the sort field, the
 * status filter, and the most sets one page holds. A track page validates them in
 * its address and its server functions' inputs, in modules that every page's
 * first JavaScript holds, so they stay apart from the list's spec and page and the
 * rows, contracts and digests those import.
 */
export const setDirectionValidator = Schema.Literals(["asc", "desc"]);
export const setSortValidator = Schema.Struct({
  direction: setDirectionValidator,
  field: Schema.Literals([
    "order",
    "publishedScore",
    "questionCount",
    "durationSeconds",
    "title",
  ]),
});
export const setFilterValidator = Schema.Literals([
  "all",
  "not-started",
  ...tryoutStatusValidator.literals,
]);

/** The most sets one page of a track's list holds, whatever the client asks for; the web's list grows to it. */
export const TRACK_SET_PAGE_LIMIT = 1000;
