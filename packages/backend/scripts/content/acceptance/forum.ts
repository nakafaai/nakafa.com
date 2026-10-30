import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { ForumFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { encodeArguments } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, FileSystem, Schema } from "effect";

/** The class whose general channel a seeded history fills: the class `class-teacher` seeds. */
const SEEDED_CLASS = "fisika-x-1";

/**
 * Seeds the history of the general channel of the seeded class of a school, in the running local
 * acceptance backend: `count` messages from a classmate, a minute apart and ending now, and the
 * class teacher's read mark after the first `read` of them. The channel, the class, and the
 * messages go to `output` for a browser test to read back.
 */
export const createAcceptanceForum = Effect.fn("contentAcceptance.createForum")(
  function* (
    root: string,
    slug: string,
    count: number,
    read: number,
    output: string
  ) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run bun run acceptance:prepare and start acceptance before seeding a forum."
      );
    }
    const args = yield* encodeArguments({
      classSlug: SEEDED_CLASS,
      count,
      read,
      slug,
    });
    const printed = yield* runLocalConvex(runtime, "forum seed", [
      "run",
      "classroom/forum/seed:history",
      args,
    ]);
    const seeded = yield* Schema.decodeEffect(ForumFixture)(printed);
    const fixture = yield* Schema.encodeEffect(ForumFixture)(seeded);
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(output, fixture, { flag: "wx", mode: 0o600 });
  }
);

/** The usage of the forum mode: the school, the number of messages, how many are read, then the file. */
const USAGE = "forum <school-slug> <count> <read> <forum-file>";
const ForumArguments = Schema.Tuple([
  Schema.String,
  Schema.FiniteFromString,
  Schema.FiniteFromString,
  Schema.String,
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
    const [slug, count, read, output] = yield* decodeModeArguments(
      USAGE,
      ForumArguments,
      args
    );
    return yield* createAcceptanceForum(root, slug, count, read, output);
  }),
} satisfies AcceptanceMode;
