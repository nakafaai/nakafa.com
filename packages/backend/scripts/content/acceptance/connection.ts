import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/** Seeds one Classroom connection of a school in the running local acceptance backend. */
export const createAcceptanceConnection = Effect.fn(
  "contentAcceptance.connection"
)(function* (root: string, slug: string, status: string) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run bun run acceptance:prepare and start acceptance before seeding a connection."
    );
  }
  yield* runLocalConvex(runtime, "connectors/seed:connection", [
    "run",
    "connectors/seed:connection",
    yield* encodeArguments({ slug, status }),
  ]);
});

/** The usage of the connection mode: the school, then the state of its connection. */
const USAGE = "connection <school-slug> <active|reconnect>";
const ConnectionArguments = Schema.Tuple([
  Schema.String,
  Schema.Literals(["active", "reconnect"]),
]);

/**
 * The connection mode of the acceptance command line: stores a Classroom connection of the school
 * that the command names, in the state that it names.
 */
export const connectionMode = {
  mode: "connection",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runConnection")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, status] = yield* decodeModeArguments(
      USAGE,
      ConnectionArguments,
      args
    );
    return yield* createAcceptanceConnection(root, slug, status);
  }),
} satisfies AcceptanceMode;
