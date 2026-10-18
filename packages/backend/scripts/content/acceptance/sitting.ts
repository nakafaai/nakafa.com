import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { SittingFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, FileSystem, Schema } from "effect";

/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/**
 * Seeds one proctored sitting of a keyed exam in the running local acceptance backend. The
 * learner with the address gets a student grant in the school's first active unit, and the
 * sitting opens now and closes an hour later. The exam, the sitting, and its token go to
 * `output` for a browser test to read back. Each call seeds a new exam and sitting.
 */
export const createAcceptanceSitting = Effect.fn(
  "contentAcceptance.createSitting"
)(function* (root: string, slug: string, email: string, output: string) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run pnpm acceptance:prepare and start acceptance before creating a sitting."
    );
  }
  const args = yield* encodeArguments({ email, slug });
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
