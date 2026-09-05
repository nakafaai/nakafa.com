import { createPortableTable } from "@repo/backend/content/snapshot/codec";
import {
  CONTENT_RUNTIME_TABLES,
  type RuntimeTables,
} from "@repo/backend/content/snapshot/tables";
import { runConvexImport } from "@repo/backend/scripts/content/runtime/ci/command";
import type { ImportConfig } from "@repo/backend/scripts/content/runtime/ci/config";
import { Console, Effect, FileSystem } from "effect";

/** Imports authenticated serving rows into the explicit local backend. */
export const importRuntimeTables = Effect.fn(
  "contentRuntime.importRuntimeTables"
)(function* (
  config: Pick<ImportConfig, "runnerTemp">,
  tables: RuntimeTables,
  backend?: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const directory = yield* fileSystem.makeTempDirectoryScoped({
    directory: config.runnerTemp,
    prefix: "runtime-import-",
  });
  yield* fileSystem.chmod(directory, 0o700);
  const logPath = `${directory}/runtime.log`;

  for (const table of CONTENT_RUNTIME_TABLES) {
    const inputPath = `${directory}/${table}.jsonl`;
    const portable = createPortableTable(table, tables[table]);
    yield* fileSystem.writeFileString(inputPath, portable.jsonLines, {
      mode: 0o600,
    });
    yield* runConvexImport({ backend, inputPath, logPath, table });
    yield* Console.log(`Imported signed runtime table ${table}.`);
  }
}, Effect.scoped);
