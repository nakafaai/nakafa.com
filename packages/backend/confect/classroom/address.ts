import { Schema } from "effect";

/**
 * The parts of a class's addresses that its pages read from the URL. They live apart from the schemas of a task
 * and a message, because a route checks its params before its page loads, and every page's first load holds the
 * routes: a route that read them from those schemas loaded a forum's faces and polls into every page.
 */

/** The address of a task in its class, as `classSlugOf` forms it from the title. */
export const TaskAddress = Schema.String.check(
  Schema.isPattern(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u),
  Schema.isMaxLength(140)
);

/** The number of a discussion in its class, from 1, like the number of an issue. */
export const DiscussionNumber = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(1)
);
