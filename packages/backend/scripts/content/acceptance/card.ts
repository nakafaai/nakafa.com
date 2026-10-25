import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { CardFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, FileSystem, Schema } from "effect";

/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/**
 * Seeds one new student of a school in the running local acceptance backend, with a student grant
 * in the school's first active unit and a login card. The login name and the plain code go to
 * `output` for a browser test to read back. Each call seeds a new student.
 */
export const createAcceptanceCard = Effect.fn("contentAcceptance.card")(
  function* (root: string, slug: string, output: string) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run bun run acceptance:prepare and start acceptance before seeding a card."
      );
    }
    const args = yield* encodeArguments({ slug });
    const printed = yield* runLocalConvex(runtime, "identity/seed:card", [
      "run",
      "identity/seed:card",
      args,
    ]);
    const seeded = yield* Schema.decodeEffect(CardFixture)(printed);
    const fixture = yield* Schema.encodeEffect(CardFixture)(seeded);
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(output, fixture, { flag: "wx", mode: 0o600 });
  }
);

/** The usage of the card mode: the school of the new student, then the file for the login card. */
const USAGE = "card <school-slug> <card-file>";
const CardArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The card mode of the acceptance command line: seeds one new student of the
 * school that the command names, with a login card, and writes the login name and
 * the plain code to the file that the command names.
 */
export const cardMode = {
  mode: "card",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runCard")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, output] = yield* decodeModeArguments(
      USAGE,
      CardArguments,
      args
    );
    return yield* createAcceptanceCard(root, slug, output);
  }),
} satisfies AcceptanceMode;
