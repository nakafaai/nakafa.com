import { tmpdir } from "node:os";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { ProducerConfig } from "@repo/backend/scripts/content/runtime/ci/access";
import type {
  ExportConfig,
  ImportConfig,
  ProductionConfig,
  ProductionSelectionConfig,
} from "@repo/backend/scripts/content/runtime/ci/config";
import { ContentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import {
  makeRuntimeCiProgram,
  type RuntimeCiOperations,
  reportRuntimeCiFailure,
} from "@repo/backend/scripts/content/runtime/ci/main";
import { DuplicateContentRuntimeTableError } from "@repo/backend/scripts/content/runtime/tables";
import { Effect, FileSystem, Redacted } from "effect";

vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: vi.fn(),
}));

const contentStateHash = "1".repeat(64);
const runtimeSchemaFingerprint = "2".repeat(64);
const runtimeSelectionHash = "3".repeat(64);
const metadata = {
  archiveSha256: "4".repeat(64),
  byteLength: 128,
  contentStateHash,
  createdAt: 1_800_000_000_000,
  runtimeSchemaFingerprint,
};

function makeOperations(runnerTemp: string, events: string[]) {
  const production: ProductionConfig = {
    deployKey: Redacted.make("production-deploy-key"),
    runnerTemp,
  };
  const selection: ProductionSelectionConfig = {
    ...production,
    runtimeSelectionHash,
  };
  const exported: ExportConfig = {
    ...production,
    cacheKey: Redacted.make("k".repeat(43)),
    contentStateHash,
    exportLimit: 100_000,
    runtimeSchemaFingerprint,
  };
  const imported: ImportConfig = {
    cacheKey: exported.cacheKey,
    contentStateHash,
    runnerTemp,
    runtimeSchemaFingerprint,
  };
  const producer: ProducerConfig = {
    ...exported,
    archiveToken: Redacted.make("archive-token"),
    runtimeToken: Redacted.make("runtime-token"),
    siteUrl: "https://production.example.test",
  };
  const fetcher = vi.fn<typeof fetch>();

  return {
    clearArchiveSecrets: Effect.sync(() => {
      events.push("clear-archive");
    }),
    clearContentSecrets: Effect.sync(() => {
      events.push("clear-content");
    }),
    download: vi.fn(() =>
      Effect.sync(() => {
        events.push("download");
        return metadata;
      })
    ),
    exportRuntime: vi.fn(() =>
      Effect.sync(() => {
        events.push("export");
      }).pipe(Effect.as(undefined))
    ),
    fetcher,
    importRuntime: vi.fn(() =>
      Effect.sync(() => {
        events.push("import");
      }).pipe(Effect.as(undefined))
    ),
    produce: vi.fn(() =>
      Effect.sync(() => {
        events.push("produce");
        return { kind: "unchanged" as const, metadata };
      })
    ),
    readExport: Effect.succeed(exported),
    readGenerations: vi.fn(() =>
      Effect.sync(() => {
        events.push("read-generations");
        return { contentStateHash, runtimeSelectionHash };
      })
    ),
    readImport: Effect.succeed(imported),
    readProducer: Effect.succeed(producer),
    readProduction: Effect.succeed(production),
    readRuntimeArchive: Effect.succeed(producer),
    readSchemaFingerprint: vi.fn(() =>
      Effect.sync(() => {
        events.push("read-fingerprint");
        return runtimeSchemaFingerprint;
      })
    ),
    readSelection: Effect.succeed(selection),
    runtimeTables: ["contentState"],
    validateRegistry: Effect.succeed([]),
    verifySelection: vi.fn(() =>
      Effect.sync(() => {
        events.push("verify-selection");
      })
    ),
  } satisfies RuntimeCiOperations;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("content runtime CI entrypoint", () => {
  it.live("dispatches every runtime mode and clears its owned secrets", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: tmpdir(),
          prefix: "runtime-main-",
        });
        vi.stubEnv("RUNNER_TEMP", runnerTemp);

        const cases = [
          { event: "read-fingerprint", mode: "fingerprint" },
          { event: "read-generations", mode: "generations" },
          { event: "verify-selection", mode: "verify-generations" },
          { event: "export", mode: "export" },
          { event: "import", mode: "import" },
          { event: "produce", mode: "produce" },
          { event: "download", mode: "download" },
        ] as const;

        for (const testCase of cases) {
          const events: string[] = [];
          const operations = makeOperations(runnerTemp, events);
          yield* makeRuntimeCiProgram(testCase.mode, operations);

          expect(events).toContain(testCase.event);
          expect(events.at(-2)).toBe("clear-content");
          expect(events.at(-1)).toBe("clear-archive");
          if (testCase.mode === "produce" || testCase.mode === "download") {
            expect(events.indexOf("clear-content")).toBeLessThan(
              events.indexOf(testCase.event)
            );
            expect(events.indexOf("clear-archive")).toBeLessThan(
              events.indexOf(testCase.event)
            );
          }
        }

        expect(
          yield* fileSystem.readFileString(`${runnerTemp}/runtime-schema.env`)
        ).toBe(`CONTENT_RUNTIME_SCHEMA_HASH=${runtimeSchemaFingerprint}\n`);
        expect(
          yield* fileSystem.readFileString(`${runnerTemp}/runtime-state.env`)
        ).toBe(
          `CONTENT_RUNTIME_STATE_HASH=${contentStateHash}\nCONTENT_RUNTIME_SELECTION_HASH=${runtimeSelectionHash}\n`
        );
        expect(NodeRuntime.runMain).toHaveBeenCalledTimes(1);
      })
    ).pipe(Effect.provide(NodeServices.layer))
  );

  it.live("rejects empty and unsafe runtime table registries before work", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: tmpdir(),
          prefix: "runtime-main-tables-",
        });
        vi.stubEnv("RUNNER_TEMP", runnerTemp);
        vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        for (const runtimeTables of [[], [""], ["contentState", "bad-name"]]) {
          const operations = {
            ...makeOperations(runnerTemp, []),
            runtimeTables,
          };
          expect(
            yield* makeRuntimeCiProgram("fingerprint", operations).pipe(
              Effect.flip
            )
          ).toMatchObject({
            message: "Signed runtime must contain safe table names.",
          });
        }
      })
    ).pipe(Effect.provide(NodeServices.layer))
  );

  it.live(
    "reports duplicate registries and unsupported modes without secrets",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "runtime-main-failure-",
          });
          const write = vi
            .spyOn(process.stderr, "write")
            .mockImplementation(() => true);
          const duplicate = {
            ...makeOperations(runnerTemp, []),
            validateRegistry: Effect.fail(
              new DuplicateContentRuntimeTableError({ table: "duplicate" })
            ),
          };

          expect(
            yield* makeRuntimeCiProgram("export", duplicate).pipe(Effect.flip)
          ).toMatchObject({
            message: "Signed runtime table registry contains a duplicate name.",
          });
          expect(
            yield* makeRuntimeCiProgram(
              "unsupported",
              makeOperations(runnerTemp, [])
            ).pipe(Effect.flip)
          ).toMatchObject({
            message: expect.stringContaining("Usage: runtime:ci"),
          });
          yield* reportRuntimeCiFailure(
            new Error("sensitive-internal-failure")
          );
          yield* reportRuntimeCiFailure(
            new ContentRuntimeCiError({ message: "safe typed failure" })
          );

          expect(write.mock.calls.flat().join("")).not.toContain(
            "sensitive-internal-failure"
          );
          expect(write.mock.calls.flat().join("")).toContain(
            "ERROR: Content runtime CI failed."
          );
          expect(write.mock.calls.flat().join("")).toContain(
            "ERROR: safe typed failure"
          );
        })
      ).pipe(Effect.provide(NodeServices.layer))
  );
});
