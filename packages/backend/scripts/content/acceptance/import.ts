import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { Effect } from "effect";

/**
 * Appends the documents of one JSON Lines file to a table of the running local
 * acceptance backend. A browser test uses it for rows that no app function
 * creates cheaply, such as a learner's chats beyond one page: creating a chat
 * runs Nina, which the local backend does not, and a learner may start only a
 * few in a minute. The rows exist only in this runtime's local database.
 */
export const importAcceptanceRows = Effect.fn("contentAcceptance.importRows")(
  function* (root: string, table: string, file: string) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run pnpm acceptance:prepare and start acceptance before importing rows."
      );
    }
    yield* runLocalConvex(runtime, "Row import", [
      "import",
      "--table",
      table,
      "--append",
      "--yes",
      file,
    ]);
  }
);
