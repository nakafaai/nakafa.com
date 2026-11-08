import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  ForumFixture,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/** The class whose general channel a seeded history fills: the class `class-teacher` seeds. */
const SEEDED_CLASS = "fisika-x-1";

/**
 * Seeds the history of the general channel of the seeded class of a school, in the running local
 * acceptance backend, and answers the channel, the class, and the messages: `count` messages from
 * a classmate, named `author` when the run gives a name, a minute apart and ending now, and the
 * class teacher's read mark after the first `read` of them.
 */
export const seedForum = Effect.fn("contentAcceptance.seedForum")(function* (
  slug: string,
  count: number,
  read: number,
  author?: string
) {
  const { run } = yield* LocalConvex;
  return yield* run("forum seed", {
    args: {
      ...(author === undefined ? {} : { author }),
      classSlug: SEEDED_CLASS,
      count,
      read,
      slug,
    },
    path: "classroom/forum/seed:history",
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(ForumFixture)));
});

/**
 * The usage of the forum mode: the school, the number of messages, how many are read, the file, and the classmate's
 * name when a run needs one.
 */
const USAGE = "forum <school-slug> <count> <read> <forum-file> [author]";
const ForumArguments = Schema.Tuple([
  Schema.String,
  Schema.FiniteFromString,
  Schema.FiniteFromString,
  Schema.String,
  Schema.optionalKey(Schema.String),
]);

/**
 * The forum mode of the acceptance command line: seeds the history of the general channel of the
 * school's seeded class, with the class teacher's read mark, and writes it to the file that the
 * command names.
 */
export const forumMode = {
  mode: "forum",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runForum")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, count, read, output, author] = yield* decodeModeArguments(
      USAGE,
      ForumArguments,
      args
    );
    const forum = yield* seedForum(slug, count, read, author).pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, ForumFixture, forum);
  }),
} satisfies AcceptanceMode;
