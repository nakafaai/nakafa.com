import { tmpdir } from "node:os";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<unknown, unknown> | undefined;
  return {
    build: vi.fn(),
    clean: vi.fn(),
    export: vi.fn(),
    generations: vi.fn(),
    import: vi.fn(),
    start: vi.fn(),
    verify: vi.fn(),
    duplicate: false,
    tables: ["contentState"],
    getEntry: () => entry,
    runMain: vi.fn((program: Effect.Effect<unknown, unknown>) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));
vi.mock("@repo/backend/scripts/content/runtime/build", () => ({
  buildApplication: mocks.build,
  startApplication: mocks.start,
}));
vi.mock("@repo/backend/scripts/content/runtime/local", () => ({
  cleanLocalRuntime: mocks.clean,
}));
vi.mock("@repo/backend/scripts/content/runtime/ci/export", () => ({
  exportSignedRuntime: mocks.export,
}));
vi.mock("@repo/backend/scripts/content/runtime/ci/import", () => ({
  importSignedRuntime: mocks.import,
}));
vi.mock("@repo/backend/scripts/content/runtime/ci/generation", () => ({
  formatGenerationEnvironment: (selection: { runtimeSelectionHash: string }) =>
    `CONTENT_RUNTIME_SELECTION_HASH=${selection.runtimeSelectionHash}`,
  readProductionGenerations: mocks.generations,
  verifyRuntimeSelection: mocks.verify,
}));
vi.mock("@repo/backend/scripts/content/runtime/tables", () => ({
  CONTENT_RUNTIME_TABLES: mocks.tables,
  readContentRuntimeSchemaFingerprint: () => Effect.succeed("a".repeat(64)),
  validateContentRuntimeTableDefinitions: Effect.suspend(() =>
    mocks.duplicate ? Effect.fail("duplicate registry") : Effect.void
  ),
}));

const originalArgv = process.argv;
const execute = Effect.fn("RuntimeCliTest.execute")(function* (
  mode: string | undefined
) {
  process.argv = ["node", "runtime"];
  if (mode !== undefined) {
    process.argv.push(mode, "--filter=www");
  }
  yield* Effect.promise(
    () => import("@repo/backend/scripts/content/runtime/ci/main")
  );
  const entry = mocks.getEntry();
  if (!entry) {
    return yield* Effect.die("CLI did not install its Effect entrypoint");
  }
  return yield* entry;
});
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "runtime-cli-test-",
  });
  vi.stubEnv("RUNNER_TEMP", directory);
  vi.stubEnv("CONVEX_DEPLOY_KEY", "prod:dapper-antelope-269|private-test-key");
  vi.stubEnv("CONVEX_DEPLOYMENT_TOKEN", "private-test-token");
  vi.stubEnv("CONTENT_RUNTIME_CACHE_KEY", "k".repeat(64));
  vi.stubEnv("CONTENT_RUNTIME_SELECTION_HASH", "b".repeat(64));
  vi.stubEnv("CONTENT_RUNTIME_SCHEMA_HASH", "a".repeat(64));
  return { fs, directory };
});

describe("runtime CLI", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.duplicate = false;
    mocks.tables.splice(0, mocks.tables.length, "contentState");
    for (const command of [
      mocks.build,
      mocks.clean,
      mocks.export,
      mocks.import,
      mocks.start,
      mocks.verify,
    ]) {
      command.mockReturnValue(Effect.void);
    }
    mocks.generations.mockReturnValue(
      Effect.succeed({ runtimeSelectionHash: "b".repeat(64) })
    );
  });
  afterEach(() => {
    process.argv = originalArgv;
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  for (const mode of [
    "build",
    "prepare",
    "start",
    "clean",
    "fingerprint",
    "generations",
    "verify-generations",
    "export",
    "import",
  ]) {
    it.live(`runs ${mode} through the CLI and erases acquisition secrets`, () =>
      Effect.gen(function* () {
        const { fs, directory } = yield* fixture;
        yield* execute(mode);
        expect(process.env.CONVEX_DEPLOY_KEY).toBeUndefined();
        expect(process.env.CONVEX_DEPLOYMENT_TOKEN).toBeUndefined();
        expect(process.env.CONTENT_RUNTIME_CACHE_KEY).toBeUndefined();
        if (mode === "build" || mode === "prepare") {
          expect(mocks.build).toHaveBeenCalledWith(
            expect.any(String),
            ["--filter=www"],
            process.env,
            mode
          );
        }
        if (mode === "start") {
          expect(mocks.start).toHaveBeenCalledWith(expect.any(String), [
            "--filter=www",
          ]);
        }
        if (mode === "clean") {
          expect(mocks.clean).toHaveBeenCalledOnce();
        }
        if (mode === "export") {
          expect(mocks.export).toHaveBeenCalledOnce();
        }
        if (mode === "import") {
          expect(mocks.import).toHaveBeenCalledOnce();
        }
        if (mode === "verify-generations") {
          expect(mocks.verify).toHaveBeenCalledOnce();
        }
        if (mode === "fingerprint" || mode === "generations") {
          const path = `${directory}/${mode === "fingerprint" ? "runtime-schema.env" : "runtime-state.env"}`;
          const value =
            mode === "fingerprint"
              ? `CONTENT_RUNTIME_SCHEMA_HASH=${"a".repeat(64)}\n`
              : `CONTENT_RUNTIME_SELECTION_HASH=${"b".repeat(64)}\n`;
          expect(yield* fs.readFileString(path)).toBe(value);
          expect((yield* fs.stat(path)).mode % 0o1000).toBe(0o600);
        }
      }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  for (const mode of [undefined, "unsupported"]) {
    it.live(`reports a safe usage error for ${mode}`, () =>
      Effect.gen(function* () {
        yield* fixture;
        const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
        expect(yield* execute(mode).pipe(Effect.flip)).toMatchObject({
          _tag: "ContentRuntimeCiError",
        });
        expect(stderr).toHaveBeenCalledWith(
          expect.stringContaining("Usage: runtime:ci")
        );
        expect(process.env.CONTENT_RUNTIME_CACHE_KEY).toBeUndefined();
      }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  for (const invalid of [
    "empty-registry",
    "empty-name",
    "unsafe-name",
    "duplicate",
  ]) {
    it.live(
      `refuses an ${invalid} table registry before output or execution`,
      () =>
        Effect.gen(function* () {
          const { fs, directory } = yield* fixture;
          vi.spyOn(process.stderr, "write").mockReturnValue(true);
          if (invalid === "empty-registry") {
            mocks.tables.splice(0);
          }
          if (invalid === "empty-name") {
            mocks.tables.splice(0, 1, "");
          }
          if (invalid === "unsafe-name") {
            mocks.tables.splice(0, 1, "../foreign");
          }
          if (invalid === "duplicate") {
            mocks.duplicate = true;
          }
          expect(yield* execute("fingerprint").pipe(Effect.flip)).toMatchObject(
            { _tag: "ContentRuntimeCiError" }
          );
          expect(yield* fs.exists(`${directory}/runtime-schema.env`)).toBe(
            false
          );
          expect(mocks.build).not.toHaveBeenCalled();
          expect(process.env.CONTENT_RUNTIME_CACHE_KEY).toBeUndefined();
        }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  it.live(
    "hides unknown failures while retaining actionable typed errors",
    () =>
      Effect.gen(function* () {
        yield* fixture;
        const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
        mocks.export.mockReturnValue(Effect.fail({ secret: "private" }));
        yield* execute("export").pipe(Effect.flip);
        expect(stderr).toHaveBeenCalledWith(
          "ERROR: Content runtime CI failed.\n"
        );
        expect(stderr).not.toHaveBeenCalledWith(
          expect.stringContaining("private")
        );
        vi.resetModules();
        const { contentRuntimeCiError } = yield* Effect.promise(
          () => import("@repo/backend/scripts/content/runtime/ci/error")
        );
        mocks.build.mockReturnValue(
          contentRuntimeCiError("signed selection changed")
        );
        yield* execute("build").pipe(Effect.flip);
        expect(stderr).toHaveBeenCalledWith(
          "ERROR: signed selection changed\n"
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );
});
