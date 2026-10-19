import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { CardFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
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
        "Run pnpm acceptance:prepare and start acceptance before seeding a card."
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
