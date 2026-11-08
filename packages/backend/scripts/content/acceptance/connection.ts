import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/** The states a seeded Classroom connection can stand in. */
const ConnectionStatus = Schema.Literals(["active", "reconnect"]);

/** Seeds one Classroom connection of a school in the running local acceptance backend. */
export const seedConnection = Effect.fn("contentAcceptance.seedConnection")(
  function* (slug: string, status: typeof ConnectionStatus.Type) {
    const { run } = yield* LocalConvex;
    yield* run("connection seed", {
      args: { slug, status },
      path: "connectors/seed:connection",
    });
  }
);

/** The usage of the connection mode: the school, then the state of its connection. */
const USAGE = "connection <school-slug> <active|reconnect>";
const ConnectionArguments = Schema.Tuple([Schema.String, ConnectionStatus]);

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
    yield* seedConnection(slug, status).pipe(
      Effect.provide(localConvexLayer(root))
    );
  }),
} satisfies AcceptanceMode;
