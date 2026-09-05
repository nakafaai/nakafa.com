import { tmpdir } from "node:os";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/content/snapshot/tables";
import { importRuntimeTables } from "@repo/backend/scripts/content/runtime/ci/import";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { Effect, FileSystem } from "effect";

const mocks = vi.hoisted(() => ({ runImport: vi.fn() }));
vi.mock("@repo/backend/scripts/content/runtime/ci/command", () => ({
  runConvexImport: mocks.runImport,
}));

beforeEach(() => {
  mocks.runImport.mockReset();
});

describe("native serving-table import", () => {
  it.live(
    "imports every validated table into the explicit backend and cleans private input files",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "runtime-import-tables-",
          });
          const tables = yield* projectActiveRuntime(
            makeRuntimeSource().source
          );
          const imported: string[] = [];
          mocks.runImport.mockImplementation(
            ({
              backend,
              inputPath,
              table,
            }: {
              backend: string;
              inputPath: string;
              table: keyof typeof tables;
            }) =>
              Effect.gen(function* () {
                expect(backend).toBe("/owned/local/backend");
                expect((yield* fileSystem.stat(inputPath)).mode % 0o1000).toBe(
                  0o600
                );
                const text = yield* fileSystem.readFileString(inputPath);
                const rows =
                  text.length === 0
                    ? []
                    : text
                        .trimEnd()
                        .split("\n")
                        .map((line): unknown => JSON.parse(line));
                expect(rows).toEqual(tables[table]);
                imported.push(table);
              })
          );
          yield* importRuntimeTables(
            { runnerTemp },
            tables,
            "/owned/local/backend"
          );
          expect(imported).toEqual(CONTENT_RUNTIME_TABLES);
          expect(yield* fileSystem.readDirectory(runnerTemp)).toEqual([]);
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );
});
