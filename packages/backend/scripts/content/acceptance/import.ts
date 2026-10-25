import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

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
        "Run bun run acceptance:prepare and start acceptance before importing rows."
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

/** The usage of the import mode: the table, then the JSON Lines file of its documents. */
const USAGE = "import <table> <rows-file>";
const ImportArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The import mode of the acceptance command line: appends the documents of the
 * rows file that the command names to the table that it names.
 */
export const importMode = {
  mode: "import",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runImport")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [table, file] = yield* decodeModeArguments(
      USAGE,
      ImportArguments,
      args
    );
    return yield* importAcceptanceRows(root, table, file);
  }),
} satisfies AcceptanceMode;
