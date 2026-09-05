import { createServer } from "node:net";
import { tmpdir } from "node:os";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  cleanLocalRuntime,
  initializeLocalRuntime,
  leaseLocalRuntime,
  localApplicationEnvironment,
  readLocalRuntime,
  releaseLocalRuntime,
  reserveLocalRuntime,
} from "@repo/backend/scripts/content/runtime/local";
import { Effect, FileSystem, Option } from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("@repo/backend/scripts/content/runtime/ci/command", () => ({
  runRuntimeCommand: mocks.command,
}));
const identity = {
  runtimeSchemaFingerprint: "a".repeat(64),
  runtimeSelectionHash: "b".repeat(64),
};
const environment =
  "VITE_CONVEX_URL=http://127.0.0.1:43120\nVITE_CONVEX_SITE_URL=http://127.0.0.1:43121\n";
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "runtime-local-test-",
  });
  const root = yield* fs.realPath(directory);
  yield* fs.makeDirectory(`${root}/packages/backend`, { recursive: true });
  yield* fs.writeFileString(
    `${root}/packages/backend/convex.json`,
    '{"node":{"nodeVersion":"24"}}'
  );
  yield* fs.writeFileString(
    `${root}/packages/backend/.env.local`,
    "CONVEX_DEPLOYMENT=developer-owned"
  );
  yield* fs.makeDirectory(`${root}/packages/backend/.convex`);
  return { fs, root };
});
const initialize = (source = environment) => {
  mocks.command.mockImplementation(
    (spec: { args: readonly string[]; cwd: string }) =>
      Effect.gen(function* () {
        if (spec.args[2] !== "init") {
          return;
        }
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString(`${spec.cwd}/.env.local`, source);
        yield* fs.makeDirectory(`${spec.cwd}/.convex/local/default`, {
          recursive: true,
        });
        yield* fs.writeFileString(
          `${spec.cwd}/.convex/local/default/config.json`,
          '{"ports":{"cloud":43120,"site":43121}}'
        );
      })
  );
};

describe("owned signed runtime", () => {
  afterEach(() => vi.resetAllMocks());

  it.live(
    "retains a reusable private database and cleans only its own state",
    () =>
      Effect.gen(function* () {
        initialize();
        const { fs, root } = yield* fixture;
        yield* reserveLocalRuntime(root);
        const runtime = yield* initializeLocalRuntime(root, identity);
        expect(yield* readLocalRuntime(root)).toEqual(runtime);
        expect((yield* fs.stat(runtime.directory)).mode % 0o1000).toBe(0o700);
        expect(
          (yield* fs.stat(`${runtime.directory}/manifest.json`)).mode % 0o1000
        ).toBe(0o600);
        expect(localApplicationEnvironment(runtime)).toMatchObject({
          CONVEX_AGENT_MODE: "anonymous",
          NEXT_PUBLIC_CONVEX_URL: runtime.query,
          CONTENT_BUILD_SNAPSHOT: undefined,
          VERCEL: undefined,
        });
        expect(mocks.command).toHaveBeenCalledTimes(2);
        expect(yield* fs.readFileString(`${runtime.backend}/convex.json`)).toBe(
          JSON.stringify({
            node: { nodeVersion: "24" },
            functions: "../../../packages/backend/convex",
          })
        );
        yield* cleanLocalRuntime(root);
        expect(yield* fs.exists(runtime.directory)).toBe(false);
        expect(
          yield* fs.readFileString(`${root}/packages/backend/.env.local`)
        ).toBe("CONVEX_DEPLOYMENT=developer-owned");
        expect(yield* fs.exists(`${root}/packages/backend/.convex`)).toBe(true);
        expect(yield* readLocalRuntime(root)).toBeUndefined();
        yield* cleanLocalRuntime(root);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.live(
    "refuses duplicate preparation and cleanup during an active lease",
    () =>
      Effect.gen(function* () {
        initialize();
        const { root } = yield* fixture;
        yield* reserveLocalRuntime(root);
        yield* initializeLocalRuntime(root, identity);
        expect(
          yield* reserveLocalRuntime(root).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentSnapshotError" });
        yield* Effect.gen(function* () {
          yield* leaseLocalRuntime(root);
          expect(
            yield* cleanLocalRuntime(root).pipe(Effect.flip)
          ).toMatchObject({
            _tag: "ContentSnapshotError",
            message: expect.stringContaining("in use"),
          });
        }).pipe(Effect.scoped);
        yield* cleanLocalRuntime(root);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  for (const occupied of ["query", "site"]) {
    it.live(
      `preserves an unleased runtime with an active ${occupied} port`,
      () =>
        Effect.gen(function* () {
          const listener = yield* Effect.acquireRelease(
            Effect.sync(() => createServer()),
            (server) =>
              Effect.callback<void>((resume) => {
                server.close(() => resume(Effect.void));
              })
          );
          yield* Effect.callback<void>((resume) => {
            listener.listen(0, "127.0.0.1", () => resume(Effect.void));
          });
          const address = listener.address();
          if (address === null || typeof address === "string") {
            return yield* Effect.die("Listener did not acquire an IP port");
          }
          initialize(
            environment.replace(
              occupied === "query" ? ":43120" : ":43121",
              `:${address.port}`
            )
          );
          const { fs, root } = yield* fixture;
          yield* reserveLocalRuntime(root);
          const runtime = yield* initializeLocalRuntime(root, identity);
          expect(yield* fs.exists(`${runtime.directory}/using`)).toBe(false);
          expect(
            yield* cleanLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
          ).toMatchObject({
            _tag: "ContentSnapshotError",
            message: expect.stringContaining("occupied"),
          });
          expect(listener.listening).toBe(true);
          expect(yield* readLocalRuntime(root)).toEqual(runtime);
          expect(yield* fs.exists(`${runtime.directory}/using`)).toBe(false);
        }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  it.live("preserves a cache redirected outside the checkout", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      yield* fs.makeDirectory(`${root}/shared`);
      yield* fs.symlink(`${root}/shared`, `${root}/.cache`);
      expect(yield* reserveLocalRuntime(root).pipe(Effect.flip)).toMatchObject({
        _tag: "ContentSnapshotError",
      });
      expect(yield* fs.exists(`${root}/shared/runtime`)).toBe(false);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.live("preserves a replaced reservation before cleanup", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const reserved = yield* reserveLocalRuntime(root);
      yield* fs.rename(reserved.directory, `${root}/original`);
      yield* fs.makeDirectory(reserved.directory);
      expect(
        yield* releaseLocalRuntime(reserved).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentSnapshotError" });
      expect(yield* fs.exists(reserved.directory)).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  for (const change of ["file", "symlink", "missing-identity"]) {
    it.live(`preserves a reservation whose directory becomes ${change}`, () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const reserved = yield* reserveLocalRuntime(root);
        yield* fs.rename(reserved.directory, `${root}/original`);
        if (change === "file") {
          yield* fs.writeFileString(reserved.directory, "foreign");
        }
        if (change === "symlink") {
          yield* fs.symlink(`${root}/original`, reserved.directory);
        }
        if (change === "missing-identity") {
          yield* fs.makeDirectory(reserved.directory);
        }
        const reader =
          change === "missing-identity"
            ? {
                ...fs,
                stat: (path: string) =>
                  fs.stat(path).pipe(
                    Effect.map((info) => ({
                      ...info,
                      ino: Option.none<number>(),
                    }))
                  ),
              }
            : fs;
        expect(
          yield* releaseLocalRuntime(reserved).pipe(
            Effect.provideService(FileSystem.FileSystem, reader),
            Effect.flip
          )
        ).toMatchObject({ _tag: "ContentSnapshotError" });
        expect(yield* fs.exists(reserved.directory)).toBe(true);
        expect(yield* fs.exists(`${root}/original`)).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  for (const operation of ["initialize", "reopen"]) {
    it.live(
      `refuses to ${operation} a database without filesystem identity`,
      () =>
        Effect.gen(function* () {
          initialize();
          const { fs, root } = yield* fixture;
          const reserved = yield* reserveLocalRuntime(root);
          if (operation === "reopen") {
            yield* initializeLocalRuntime(root, identity);
          }
          const reader = {
            ...fs,
            stat: (path: string) =>
              fs
                .stat(path)
                .pipe(
                  Effect.map((info) =>
                    path.endsWith("/.convex")
                      ? { ...info, ino: Option.none<number>() }
                      : info
                  )
                ),
          };
          const program =
            operation === "initialize"
              ? initializeLocalRuntime(root, identity)
              : readLocalRuntime(root);
          expect(
            yield* program.pipe(
              Effect.provideService(FileSystem.FileSystem, reader),
              Effect.flip
            )
          ).toMatchObject({ _tag: "ContentSnapshotError" });
          yield* releaseLocalRuntime(reserved);
        }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  for (const change of [
    "environment",
    "configuration",
    "manifest",
    "database",
    "directory",
    "foreign-backend",
    "foreign-inode",
    "environment-link",
    "database-link",
  ]) {
    it.live(`preserves a runtime after its ${change} changes`, () =>
      Effect.gen(function* () {
        initialize();
        const { fs, root } = yield* fixture;
        yield* reserveLocalRuntime(root);
        const runtime = yield* initializeLocalRuntime(root, identity);
        const manifest = `${runtime.directory}/manifest.json`;
        if (change === "environment") {
          yield* fs.writeFileString(
            `${runtime.backend}/.env.local`,
            `${environment}OTHER=selection`
          );
        }
        if (change === "configuration") {
          yield* fs.writeFileString(
            `${runtime.backend}/.convex/local/default/config.json`,
            "{}"
          );
        }
        if (change === "manifest") {
          yield* fs.writeFileString(manifest, "{}");
        }
        if (change === "database") {
          yield* fs.writeFileString(
            manifest,
            JSON.stringify({ ...runtime, databaseInode: -1 })
          );
        }
        if (change === "directory") {
          yield* fs.writeFileString(
            manifest,
            JSON.stringify({ ...runtime, directory: "foreign" })
          );
        }
        if (change === "foreign-backend") {
          yield* fs.writeFileString(
            manifest,
            JSON.stringify({ ...runtime, backend: "foreign" })
          );
        }
        if (change === "foreign-inode") {
          yield* fs.writeFileString(
            manifest,
            JSON.stringify({ ...runtime, directoryInode: -1 })
          );
        }
        if (change === "environment-link" || change === "database-link") {
          const target =
            change === "environment-link"
              ? `${runtime.backend}/.env.local`
              : `${runtime.backend}/.convex`;
          yield* fs.rename(target, `${root}/foreign`);
          yield* fs.symlink(`${root}/foreign`, target);
        }
        expect(yield* cleanLocalRuntime(root).pipe(Effect.flip)).toMatchObject({
          _tag: "ContentSnapshotError",
        });
        expect(yield* fs.exists(runtime.directory)).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  for (const source of [
    "invalid",
    environment.replace(":43121", ":43120"),
    environment.replace(":43120", ":70000"),
    environment.replace(
      "http://127.0.0.1:43120",
      "https://production.convex.cloud"
    ),
  ]) {
    it.live(
      `rejects invalid local URLs from Convex: ${source.slice(0, 35)}`,
      () =>
        Effect.gen(function* () {
          initialize(source);
          const { root } = yield* fixture;
          const reserved = yield* reserveLocalRuntime(root);
          expect(
            yield* initializeLocalRuntime(root, identity).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentSnapshotError" });
          yield* releaseLocalRuntime(reserved);
        }).pipe(Effect.provide(NodeServices.layer))
    );
  }
});
