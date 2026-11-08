import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Schema,
  String as Str,
} from "effect";

/**
 * Appends documents to a table of the running local acceptance backend, past
 * every function, for rows that no app function creates cheaply, such as a
 * learner's chats beyond one page: creating a chat runs Nina, which the local
 * backend does not, and a learner may start only a few in a minute. The rows
 * exist only in this runtime's local database.
 */
export const appendRows = Effect.fn("contentAcceptance.appendRows")(function* (
  table: string,
  rows: readonly unknown[]
) {
  const convex = yield* LocalConvex;
  yield* convex.importRows(table, rows);
});

/** The usage of the import mode: the table, then the JSON Lines file of its documents. */
const USAGE = "import <table> <rows-file>";
const ImportArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The import mode of the acceptance command line: appends the documents of the
 * JSON Lines file that the command names to the table that it names.
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
    const text = yield* (yield* FileSystem.FileSystem).readFileString(file);
    const rows = yield* Effect.forEach(
      Arr.filter(Str.split(text, "\n"), Str.isNonEmpty),
      (line) => Schema.decodeEffect(JsonTextSchema)(line)
    );
    yield* appendRows(table, rows).pipe(Effect.provide(localConvexLayer(root)));
  }),
} satisfies AcceptanceMode;
