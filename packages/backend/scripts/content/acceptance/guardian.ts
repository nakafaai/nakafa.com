import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { GuardianFixture } from "@repo/backend/scripts/content/acceptance/fixture";
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
 * Seeds a parent's sign-in in the running local acceptance backend: the NISN of each student
 * that the address is linked to, and a live code for the address. The plain code goes to
 * `output` for a browser test to read back, in place of the mail that would carry it.
 */
export const createAcceptanceGuardian = Effect.fn("contentAcceptance.guardian")(
  function* (
    root: string,
    slug: string,
    email: string,
    nisn: string,
    output: string
  ) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run bun run acceptance:prepare and start acceptance before seeding a guardian."
      );
    }
    const args = yield* encodeArguments({ email, nisn, slug });
    const printed = yield* runLocalConvex(runtime, "guardians/seed:code", [
      "run",
      "guardians/seed:code",
      args,
    ]);
    const seeded = yield* Schema.decodeEffect(GuardianFixture)(printed);
    const fixture = yield* Schema.encodeEffect(GuardianFixture)(seeded);
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(output, fixture, { flag: "wx", mode: 0o600 });
  }
);

/** The usage of the guardian mode: the school, the linked address, the NISN, and the file for the code. */
const USAGE = "guardian <school-slug> <email> <nisn> <code-file>";
const GuardianArguments = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.String,
]);

/**
 * The guardian mode of the acceptance command line: seeds a parent's sign-in for an address
 * that the school linked, and writes the plain code to the file that the command names.
 */
export const guardianMode = {
  mode: "guardian",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runGuardian")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, email, nisn, output] = yield* decodeModeArguments(
      USAGE,
      GuardianArguments,
      args
    );
    return yield* createAcceptanceGuardian(root, slug, email, nisn, output);
  }),
} satisfies AcceptanceMode;
