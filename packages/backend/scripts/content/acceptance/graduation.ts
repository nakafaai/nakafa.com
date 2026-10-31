import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { GraduationFixture } from "@repo/backend/scripts/content/acceptance/fixture";
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
 * Seeds a graduation in the running local acceptance backend (ADR 0033, S6): a class group of the
 * last grade of the school's first active unit with the learner of the address placed in it, a
 * NISN on file, the unit's NPSN, and a locked report card. The class group goes to `output` for
 * a browser test to read back. Each call seeds a new class group.
 */
export const createAcceptanceGraduation = Effect.fn(
  "contentAcceptance.createGraduation"
)(function* (root: string, slug: string, email: string, output: string) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run bun run acceptance:prepare and start acceptance before seeding a graduation."
    );
  }
  const args = yield* encodeArguments({ email, slug });
  const printed = yield* runLocalConvex(runtime, "records/seed:graduation", [
    "run",
    "records/seed:graduation",
    args,
  ]);
  const seeded = yield* Schema.decodeEffect(GraduationFixture)(printed);
  const fixture = yield* Schema.encodeEffect(GraduationFixture)(seeded);
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(output, fixture, { flag: "wx", mode: 0o600 });
});

/** The usage of the graduation mode: the school, the learner, and the file for the class group. */
const USAGE = "graduation <school-slug> <learner-email> <graduation-file>";
const GraduationArguments = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
]);

/**
 * The graduation mode of the acceptance command line: seeds one graduating class group for the
 * learner that the command names, and writes it to the file that the command names.
 */
export const graduationMode = {
  mode: "graduation",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runGraduation")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, email, output] = yield* decodeModeArguments(
      USAGE,
      GraduationArguments,
      args
    );
    return yield* createAcceptanceGraduation(root, slug, email, output);
  }),
} satisfies AcceptanceMode;
