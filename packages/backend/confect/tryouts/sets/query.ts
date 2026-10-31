import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";

/**
 * The query a learner makes of a track's sets: the direction, the sort field and
 * the status filter. A track page validates them in its address, in route options
 * that every page's first JavaScript holds, so they stay apart from the list's
 * spec and the rows, paging and contracts it imports.
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
