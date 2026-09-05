import { tmpdir } from "node:os";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import {
  assertBuildHost,
  buildApplication,
  startApplication,
} from "@repo/backend/scripts/content/runtime/build";
import {
  makeRuntimeSource,
  TEST_SNAPSHOT_SELECTION_HASH,
} from "@repo/backend/test/content/snapshot";
import { Effect, FileSystem } from "effect";

const mocks = vi.hoisted(() => ({
  compile: vi.fn(),
  command: vi.fn(),
  export: vi.fn(),
  generations: vi.fn(),
  generationRead: vi.fn(),
  import: vi.fn(),
  initialize: vi.fn(),
  lease: vi.fn(),
  read: vi.fn(),
  release: vi.fn(),
  reserve: vi.fn(),
  snapshot: vi.fn(),
  backend: vi.fn(),
}));
vi.mock("@repo/backend/scripts/content/runtime/ci/command", () => ({
  runRuntimeCommand: mocks.command,
}));
vi.mock("@repo/backend/scripts/content/runtime/ci/export", () => ({
  exportSignedRuntime: mocks.export,
}));
vi.mock("@repo/backend/scripts/content/runtime/ci/import", () => ({
  importRuntimeTables: mocks.import,
}));
vi.mock("@repo/backend/scripts/content/runtime/ci/read", () => ({
  readSignedRuntime: mocks.snapshot,
}));
vi.mock("@repo/backend/scripts/content/runtime/ci/generation", () => ({
  readProductionGenerations: mocks.generations,
}));
vi.mock("@repo/backend/scripts/content/runtime/local", async (load) => ({
  ...(await load<
    typeof import("@repo/backend/scripts/content/runtime/local")
  >()),
  initializeLocalRuntime: mocks.initialize,
  leaseLocalRuntime: mocks.lease,
  readLocalRuntime: mocks.read,
  releaseLocalRuntime: mocks.release,
  reserveLocalRuntime: mocks.reserve,
}));
vi.mock("@repo/backend/scripts/content/runtime/process", async (load) => ({
  ...(await load<
    typeof import("@repo/backend/scripts/content/runtime/process")
  >()),
  runBuildCommand: mocks.compile,
  withLocalBackend: mocks.backend,
}));
vi.mock("@repo/backend/content/snapshot/tables", async (load) => ({
  ...(await load<typeof import("@repo/backend/content/snapshot/tables")>()),
  readContentRuntimeSchemaFingerprint: () => Effect.succeed("a".repeat(64)),
}));

const credentials = {
  CONTENT_RUNTIME_CACHE_KEY: "k".repeat(64),
  CONVEX_DEPLOY_KEY: "prod:dapper-antelope-269|test-key",
};
const host = {
  ...credentials,
  NEXT_PUBLIC_CONVEX_URL: "https://dapper-antelope-269.convex.cloud",
  VITE_CONVEX_SITE_URL: "https://dapper-antelope-269.convex.site",
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_TARGET_ENV: "production",
  VERCEL_PROJECT_ID: "prj_QfxvXBST46wuSTOXPn4PE32NqbF4",
  VERCEL_DEPLOYMENT_ID: "dpl_protected",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: "nakafaai",
  VERCEL_GIT_REPO_SLUG: "nakafa.com",
  VERCEL_GIT_COMMIT_REF: "main",
  VERCEL_GIT_COMMIT_SHA: "1".repeat(40),
};
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "runtime-build-test-",
  });
  const directory = `${root}/.cache/runtime`;
  const runtime = {
    backend: `${directory}/backend`,
    directory,
    directoryInode: 1,
    databaseInode: 2,
    configurationHash: "config",
    environmentHash: "env",
    query: "http://127.0.0.1:43120",
    site: "http://127.0.0.1:43121",
    runtimeSchemaFingerprint: "a".repeat(64),
    runtimeSelectionHash: TEST_SNAPSHOT_SELECTION_HASH,
  };
  mocks.reserve.mockImplementation(() =>
    fs
      .makeDirectory(directory, { recursive: true })
      .pipe(Effect.as({ directory, directoryInode: 1 }))
  );
  mocks.initialize.mockReturnValue(Effect.succeed(runtime));
  yield* fs.writeFileString(`${root}/snapshot.gpg`, "ciphertext");
  return {
    fs,
    root,
    runtime,
    supplied: {
      CONTENT_RUNTIME_CACHE_KEY: credentials.CONTENT_RUNTIME_CACHE_KEY,
      CONTENT_RUNTIME_SELECTION_HASH: runtime.runtimeSelectionHash,
      CONTENT_RUNTIME_SNAPSHOT: `${root}/snapshot.gpg`,
    },
  };
});

describe("shared application build lifecycle", () => {
  beforeEach(() => {
    mocks.compile.mockReturnValue(Effect.void);
    mocks.import.mockReturnValue(Effect.void);
    mocks.lease.mockReturnValue(Effect.void);
    mocks.release.mockReturnValue(Effect.void);
    mocks.read.mockReturnValue(Effect.void);
    mocks.backend.mockImplementation((_runtime, program) => program);
    mocks.generations.mockReturnValue(
      Effect.sync(() => {
        mocks.generationRead();
        return { runtimeSelectionHash: TEST_SNAPSHOT_SELECTION_HASH };
      })
    );
    mocks.snapshot.mockReturnValue(
      projectActiveRuntime(makeRuntimeSource().source)
    );
    mocks.command.mockImplementation(
      (spec: { command: string; args: readonly string[] }) =>
        Effect.gen(function* () {
          if (spec.command !== "curl") {
            return;
          }
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(spec.args.at(-1) ?? "", "downloaded");
        })
    );
    mocks.export.mockImplementation((config: { runnerTemp: string }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString(
          `${config.runnerTemp}/runtime-cache/runtime.tar.gpg`,
          "exported"
        );
      })
    );
  });
  afterEach(() => vi.resetAllMocks());

  it.effect(
    "accepts ordinary hosts and the exact protected production identity",
    () =>
      Effect.gen(function* () {
        expect(yield* assertBuildHost({})).toBe(false);
        expect(yield* assertBuildHost(host)).toBe(true);
      })
  );

  for (const change of [
    { VERCEL: "0" },
    { VERCEL_GIT_COMMIT_REF: "feature" },
    { VERCEL_PROJECT_ID: "foreign" },
    { NEXT_PUBLIC_CONVEX_URL: "https://foreign.convex.cloud" },
    { VITE_CONVEX_SITE_URL: "https://foreign.convex.site" },
  ]) {
    it.effect(
      `rejects untrusted production before reading or mutating state: ${Object.keys(change)[0]}`,
      () =>
        Effect.gen(function* () {
          expect(
            yield* buildApplication("/unused", [], { ...host, ...change }).pipe(
              Effect.flip
            )
          ).toMatchObject({ _tag: "ContentSnapshotError" });
          expect(mocks.reserve).not.toHaveBeenCalled();
          expect(mocks.generations).not.toHaveBeenCalled();
        }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  it.effect(
    "preserves ordinary configured builds and forwards root arguments",
    () =>
      Effect.gen(function* () {
        yield* buildApplication("/checkout", ["--filter=www"], {});
        expect(mocks.compile).toHaveBeenCalledWith("/checkout", [
          process.execPath,
          "/checkout/node_modules/turbo/bin/turbo",
          "run",
          "build",
          "--filter=www",
        ]);
        expect(mocks.reserve).not.toHaveBeenCalled();
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.live(
    "prepares a supplied snapshot without a production read or application build",
    () =>
      Effect.gen(function* () {
        const { fs, root, runtime, supplied } = yield* fixture;
        yield* buildApplication(root, [], supplied, "prepare");
        expect(mocks.import).toHaveBeenCalledWith(
          expect.objectContaining({
            runtimeSelectionHash: runtime.runtimeSelectionHash,
          }),
          expect.objectContaining({
            contentState: [makeRuntimeSource().state],
          }),
          runtime.backend
        );
        expect(mocks.generations).not.toHaveBeenCalled();
        expect(mocks.compile).not.toHaveBeenCalled();
        expect(mocks.release).not.toHaveBeenCalled();
        expect(
          yield* fs.readFileString(supplied.CONTENT_RUNTIME_SNAPSHOT)
        ).toBe("ciphertext");
        expect(yield* fs.exists(`${runtime.directory}/runtime-cache`)).toBe(
          false
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.live(
    "builds the prepared database and starts it later without rebuilding",
    () =>
      Effect.gen(function* () {
        const { root, runtime } = yield* fixture;
        mocks.read.mockReturnValue(Effect.succeed(runtime));
        yield* buildApplication(root, [], {});
        expect(mocks.compile).toHaveBeenCalledTimes(3);
        expect(mocks.compile).toHaveBeenLastCalledWith(
          root,
          [
            process.execPath,
            `${root}/node_modules/turbo/bin/turbo`,
            "run",
            "build",
          ],
          expect.objectContaining({ NEXT_PUBLIC_CONVEX_URL: runtime.query })
        );
        mocks.compile.mockClear();
        yield* startApplication(root, ["--filter=www"]);
        expect(mocks.compile).toHaveBeenCalledOnce();
        expect(mocks.compile).toHaveBeenCalledWith(
          root,
          [
            process.execPath,
            `${root}/node_modules/turbo/bin/turbo`,
            "run",
            "start",
            "--filter=www",
          ],
          expect.objectContaining({ NEXT_PUBLIC_CONVEX_URL: runtime.query })
        );
        expect(mocks.lease).toHaveBeenCalledTimes(2);
        expect(mocks.reserve).not.toHaveBeenCalled();
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "starts ordinary configured apps without provisioning a backend",
    () =>
      Effect.gen(function* () {
        yield* startApplication("/checkout", []);
        expect(mocks.compile).toHaveBeenCalledWith("/checkout", [
          process.execPath,
          "/checkout/node_modules/turbo/bin/turbo",
          "run",
          "start",
        ]);
        expect(mocks.backend).not.toHaveBeenCalled();
      }).pipe(Effect.provide(NodeServices.layer))
  );

  for (const source of ["download", "missing", "empty"]) {
    it.live(
      `selects and verifies the current snapshot with a ${source} release asset`,
      () =>
        Effect.gen(function* () {
          const { fs, root, runtime } = yield* fixture;
          if (source === "missing") {
            mocks.command.mockReturnValue(
              Effect.fail(contentSnapshotError("not found"))
            );
          }
          if (source === "empty") {
            mocks.command.mockReturnValue(Effect.void);
          }
          const output = `${root}/output`;
          yield* buildApplication(root, [], {
            ...credentials,
            CONTENT_RUNTIME_BUILD: "local-static",
            GITHUB_OUTPUT: output,
          });
          expect(mocks.export).toHaveBeenCalledTimes(
            source === "download" ? 0 : 1
          );
          expect(mocks.generationRead).toHaveBeenCalledTimes(3);
          expect(mocks.compile).toHaveBeenCalledTimes(3);
          expect(yield* fs.readFileString(output)).toBe(
            `CONTENT_RUNTIME_SELECTION_HASH=${runtime.runtimeSelectionHash}\n`
          );
          expect(mocks.release).not.toHaveBeenCalled();
        }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  it.live(
    "keeps production browser URLs while Vercel compiles the verified file snapshot and removes temporary state",
    () =>
      Effect.gen(function* () {
        const { root, runtime } = yield* fixture;
        yield* buildApplication(root, ["--filter=www"], host);
        expect(mocks.command).toHaveBeenCalledWith(
          expect.objectContaining({ command: "dnf" })
        );
        expect(mocks.compile).toHaveBeenLastCalledWith(
          root,
          [
            process.execPath,
            `${root}/node_modules/turbo/bin/turbo`,
            "run",
            "build",
            "--filter=www",
          ],
          expect.objectContaining({
            CONTENT_BUILD_SNAPSHOT: `${runtime.directory}/serving/snapshot.json`,
            CONTENT_RUNTIME_SELECTION_HASH: TEST_SNAPSHOT_SELECTION_HASH,
            CONTENT_RUNTIME_SCHEMA_HASH: runtime.runtimeSchemaFingerprint,
            NEXT_PUBLIC_CONVEX_URL: host.NEXT_PUBLIC_CONVEX_URL,
            NEXT_PUBLIC_CONVEX_SITE_URL: host.VITE_CONVEX_SITE_URL,
            TURBO_CONCURRENCY: "2",
          })
        );
        expect(mocks.initialize).not.toHaveBeenCalled();
        expect(mocks.backend).not.toHaveBeenCalled();
        expect(mocks.import).not.toHaveBeenCalled();
        expect(mocks.release).toHaveBeenCalledOnce();
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects a stale supplied snapshot on protected Vercel", () =>
    Effect.gen(function* () {
      expect(
        yield* buildApplication("/unused", [], {
          ...host,
          CONTENT_RUNTIME_SNAPSHOT: "/stale",
        }).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentSnapshotError" });
      expect(mocks.reserve).not.toHaveBeenCalled();
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.live(
    "releases temporary state before compilation when snapshot authentication fails",
    () =>
      Effect.gen(function* () {
        const { root, supplied } = yield* fixture;
        mocks.snapshot.mockReturnValue(
          Effect.fail(contentSnapshotError("signature rejected"))
        );
        expect(
          yield* buildApplication(root, [], supplied).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentSnapshotError",
          message: "signature rejected",
        });
        expect(mocks.compile).not.toHaveBeenCalled();
        expect(mocks.initialize).not.toHaveBeenCalled();
        expect(mocks.import).not.toHaveBeenCalled();
        expect(mocks.release).toHaveBeenCalledOnce();
      }).pipe(Effect.provide(NodeServices.layer))
  );
});
