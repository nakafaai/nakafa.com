/**
 * How many rows each list of the school home holds at most. The read keeps these bounds, and the home shows a
 * list that reaches its bound as "N+", so no count is ever shown as exact past a bound. The module declares
 * numbers only, so the browser reads the same bounds that the read does.
 */

/** The most rooms that the school home lists as running now, and the most that open within fourteen days. */
export const HOME_ROOM_LIMIT = 5;

/** The most drafts that the school home lists for the viewer. */
export const HOME_DRAFT_LIMIT = 4;

/** The most closed sittings that the school home lists for results. */
export const HOME_RESULT_LIMIT = 5;
