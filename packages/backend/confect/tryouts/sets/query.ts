import type { SetLevel } from "@nakafa/aksara-contracts/assessment/catalog";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Array as Arr, Record as Rec, Schema } from "effect";

/**
 * The query a learner makes of a track's sets: the direction, the sort field, the
 * status filter, the level filter, and the most sets one page holds. A track page validates them in
 * its address and its server functions' inputs, in modules that every page's
 * first JavaScript holds, so they stay apart from the list's spec and page and the
 * rows, contracts and digests those import.
 */
export const setDirectionValidator = Schema.Literals(["asc", "desc"]);
export const setSortValidator = Schema.Struct({
  direction: setDirectionValidator,
  field: Schema.Literals([
    "order",
    "level",
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

/**
 * The levels of a set in the contract's order, easy first, which is also the order the level column sorts by. The
 * contract's own Schema stays out of this module, because it brings the whole catalog contract into every page's
 * first JavaScript: the type holds each name to the contract's, and the module's test holds the list and its order
 * to the contract's literals.
 */
export const setLevelValidator = Schema.Literals([
  "easy",
  "medium",
  "hard",
  "cooked",
] as const satisfies readonly SetLevel[]);

/** The level a learner filters a track's sets by: every level, or one. */
export const setLevelFilterValidator = Schema.Literals([
  "all",
  ...setLevelValidator.literals,
]);

/** Each level's place in the contract's order, easy first. */
const SET_LEVEL_RANKS = Rec.fromEntries(
  Arr.map(setLevelValidator.literals, (level, rank) => [level, rank] as const)
);

/** A level's place in the contract's order, easy first. */
export function setLevelRank(level: SetLevel) {
  return SET_LEVEL_RANKS[level];
}

/** The most sets one page of a track's list holds, whatever the client asks for; the web's list grows to it. */
export const TRACK_SET_PAGE_LIMIT = 1000;
