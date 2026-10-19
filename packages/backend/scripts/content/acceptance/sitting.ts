import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { SittingFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, FileSystem, Schema } from "effect";

/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/** The number of extra students a seed seats, as the command line names it. */
const decodeCrowd = Schema.decodeEffect(Schema.FiniteFromString);

/**
 * Seeds one proctored sitting of a keyed exam in the running local acceptance backend. The
 * learner with the address gets a student grant in the school's first active unit, and the
 * sitting opens now and closes an hour later. A `crowd` seats that many extra students with
 * attempts in progress, so a test reads a dashboard of more than one page. The exam, the
 * sitting, and its token go to `output` for a browser test to read back. Each call seeds a
 * new exam and sitting.
 */
export const createAcceptanceSitting = Effect.fn(
  "contentAcceptance.createSitting"
)(function* (
  root: string,
  slug: string,
  email: string,
  output: string,
  crowd: string | undefined
) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run pnpm acceptance:prepare and start acceptance before creating a sitting."
    );
  }
  const args = yield* encodeArguments(
    crowd === undefined
      ? { email, slug }
      : { crowd: yield* decodeCrowd(crowd), email, slug }
  );
  const printed = yield* runLocalConvex(runtime, "exams/seed:sitting", [
    "run",
    "exams/seed:sitting",
    args,
  ]);
  const seeded = yield* Schema.decodeEffect(SittingFixture)(printed);
  const fixture = yield* Schema.encodeEffect(SittingFixture)(seeded);
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(output, fixture, { flag: "wx", mode: 0o600 });
});

/** The usage of the sitting mode: the school, the learner, the file for the sitting, then the optional crowd. */
const USAGE = "sitting <school-slug> <learner-email> <sitting-file> [crowd]";
const SittingArguments = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.optionalKey(Schema.String),
]);

/**
 * The sitting mode of the acceptance command line: seeds one proctored sitting for
 * the learner that the command names, with the optional number of extra students,
 * and writes the sitting to the file that the command names.
 */
export const sittingMode = {
  mode: "sitting",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runSitting")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, email, output, crowd] = yield* decodeModeArguments(
      USAGE,
      SittingArguments,
      args
    );
    return yield* createAcceptanceSitting(root, slug, email, output, crowd);
  }),
} satisfies AcceptanceMode;
