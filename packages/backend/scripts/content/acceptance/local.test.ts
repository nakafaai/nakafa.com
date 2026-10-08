import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  cleanLocalRuntime,
  discardSignedResponses,
  initializeLocalRuntime,
  leaseLocalRuntime,
  localApplicationEnvironment,
  RuntimeManifest,
  readLocalRuntime,
  releaseLocalRuntime,
  reserveLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import { Array as Arr, Effect, FileSystem, Option, Schema } from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));
const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
// The codec production decodes manifest.json with, so tampered files keep its wire shape.
const encodeManifest = Schema.encodeEffect(
  Schema.fromJsonString(RuntimeManifest)
);
const environment =
  "VITE_CONVEX_URL=http://127.0.0.1:43120\nVITE_CONVEX_SITE_URL=http://127.0.0.1:43121\n";
const LOCAL_JWKS_LINE =
  /^JWKS='\[\{"alg":"RS256","createdAt":\d+,"id":"[^"]+","privateKey":"\\"[0-9a-f]+\\"","publicKey":"\{[^']+\}"\}\]'$/mu;
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "acceptance-local-test-",
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
  // Temporary roots that existed while their Convex command ran.
  const temporaryRoots: string[] = [];
  mocks.command.mockImplementation(
    (spec: {
      args: readonly string[];
      cwd: string;
      env: Readonly<Record<string, string | undefined>>;
    }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = spec.env.TMPDIR;
        if (root !== undefined && (yield* fs.exists(root))) {
          temporaryRoots.push(root);
        }
        if (spec.args[1] !== "init") {
          return;
        }
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
  return temporaryRoots;
};

describe("owned signed acceptance runtime", () => {
  afterEach(() => vi.resetAllMocks());

  it.live(
    "retains a reusable private database and cleans only its own state",
    () =>
      Effect.gen(function* () {
        const temporaryRoots = initialize();
        const { fs, root } = yield* fixture;
        yield* reserveLocalRuntime(root);
        const runtime = yield* initializeLocalRuntime(root);
        // Each Convex command ran in its own root, removed once it stopped.
        expect(Arr.dedupe(temporaryRoots).length).toBe(2);
        for (const temporaryRoot of temporaryRoots) {
          expect(yield* fs.exists(temporaryRoot)).toBe(false);
        }
        expect(yield* readLocalRuntime(root)).toEqual(runtime);
        expect((yield* fs.stat(runtime.directory)).mode % 0o1000).toBe(0o700);
        expect(
          (yield* fs.stat(`${runtime.directory}/manifest.json`)).mode % 0o1000
        ).toBe(0o600);
        const privateKey = yield* fs.readFileString(
          runtime.signing.privateKeyPath
        );
        expect(
          yield* fs.readFileString(`${runtime.directory}/manifest.json`)
        ).not.toContain(privateKey);
        const publicKeyJson = yield* encodeJson(runtime.signing.publicKeyPem);
        expect(mocks.command).toHaveBeenLastCalledWith(
          expect.objectContaining({
            stdin: expect.stringContaining(
              `AKSARA_AGENT_SIGNING_PUBLIC_KEY=${publicKeyJson}`
            ),
          })
        );
        expect(mocks.command).not.toHaveBeenCalledWith(
          expect.objectContaining({
            stdin: expect.stringContaining(privateKey),
          })
        );
        // Each runtime signs its learners' sessions with a key of its own.
        expect(mocks.command).toHaveBeenLastCalledWith(
          expect.objectContaining({
            stdin: expect.stringMatching(LOCAL_JWKS_LINE),
          })
        );
        expect(localApplicationEnvironment(runtime)).toMatchObject({
          CONVEX_AGENT_MODE: "anonymous",
          NEXT_PUBLIC_APP_URL: "http://localhost:3000",
          NEXT_PUBLIC_CONVEX_URL: runtime.query,
          POSTHOG_PROXY_HOST: runtime.analytics,
          SITE_URL: "http://localhost:3000",
          AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
          AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
          AKSARA_PUBLICATION_TOKEN: runtime.publicationToken,
          AKSARA_ACCEPTANCE_PRIVATE_KEY: undefined,
          AKSARA_SIGNING_PRIVATE_KEY: undefined,
          VERCEL: undefined,
        });
        expect(mocks.command).toHaveBeenCalledTimes(2);
        expect(yield* fs.readFileString(`${runtime.backend}/convex.json`)).toBe(
          yield* encodeJson({
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
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "drops signed fetch responses on demand and at cleanup, keeping other caches",
    () =>
      Effect.gen(function* () {
        initialize();
        const { fs, root } = yield* fixture;
        const cache = `${root}/apps/www/.next/cache`;
        const cacheSignedResponse = () =>
          Effect.gen(function* () {
            yield* fs.makeDirectory(`${cache}/fetch-cache`, {
              recursive: true,
            });
            yield* fs.writeFileString(`${cache}/fetch-cache/entry`, "{}");
          });
        yield* fs.makeDirectory(`${cache}/images`, { recursive: true });
        yield* cacheSignedResponse();
        yield* discardSignedResponses(root);
        expect(yield* fs.exists(`${cache}/fetch-cache`)).toBe(false);
        expect(yield* fs.exists(`${cache}/images`)).toBe(true);
        yield* reserveLocalRuntime(root);
        yield* initializeLocalRuntime(root);
        yield* cacheSignedResponse();
        yield* cleanLocalRuntime(root);
        expect(yield* fs.exists(`${cache}/fetch-cache`)).toBe(false);
        expect(yield* fs.exists(`${cache}/images`)).toBe(true);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live("refuses to discard signed responses from a redirected cache", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const shared = yield* fs.makeTempDirectoryScoped({
        directory: tmpdir(),
        prefix: "acceptance-shared-cache-",
      });
      yield* fs.makeDirectory(`${shared}/fetch-cache`);
      yield* fs.writeFileString(`${shared}/fetch-cache/entry`, "{}");
      yield* fs.makeDirectory(`${root}/apps/www/.next`, { recursive: true });
      yield* fs.symlink(shared, `${root}/apps/www/.next/cache`);
      const failure = yield* discardSignedResponses(root).pipe(Effect.flip);
      expect(failure.message).toBe(
        "The Next.js build cache must belong to this checkout."
      );
      expect(yield* fs.exists(`${shared}/fetch-cache/entry`)).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live(
    "keeps the runtime for a retry when its signed responses cannot be removed",
    () =>
      Effect.gen(function* () {
        initialize();
        const { fs, root } = yield* fixture;
        const cache = `${root}/apps/www/.next/cache`;
        yield* fs.makeDirectory(`${cache}/fetch-cache`, { recursive: true });
        yield* fs.writeFileString(`${cache}/fetch-cache/entry`, "{}");
        yield* reserveLocalRuntime(root);
        yield* initializeLocalRuntime(root);
        yield* fs.chmod(cache, 0o500);
        const failure = yield* cleanLocalRuntime(root).pipe(
          Effect.scoped,
          Effect.flip
        );
        yield* fs.chmod(cache, 0o700);
        expect(failure).toMatchObject({ _tag: "PlatformError" });
        expect(yield* readLocalRuntime(root)).toBeDefined();
        yield* cleanLocalRuntime(root).pipe(Effect.scoped);
        expect(yield* readLocalRuntime(root)).toBeUndefined();
        expect(yield* fs.exists(`${cache}/fetch-cache`)).toBe(false);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "refuses duplicate preparation and cleanup during an active lease",
    () =>
      Effect.gen(function* () {
        initialize();
        const { root } = yield* fixture;
        yield* reserveLocalRuntime(root);
        yield* initializeLocalRuntime(root);
        expect(
          yield* reserveLocalRuntime(root).pipe(Effect.flip)
        ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
        yield* Effect.gen(function* () {
          yield* leaseLocalRuntime(root);
          expect(
            yield* cleanLocalRuntime(root).pipe(Effect.flip)
          ).toMatchObject({
            _tag: "AcceptanceRuntimeError",
            message: expect.stringContaining("in use"),
          });
        }).pipe(Effect.scoped);
        yield* cleanLocalRuntime(root);
      }).pipe(Effect.provide(nodeServicesLayer))
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
          const runtime = yield* initializeLocalRuntime(root);
          expect(yield* fs.exists(`${runtime.directory}/using`)).toBe(false);
          expect(
            yield* cleanLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
          ).toMatchObject({
            _tag: "AcceptanceRuntimeError",
            message: expect.stringContaining("occupied"),
          });
          expect(listener.listening).toBe(true);
          expect(yield* readLocalRuntime(root)).toEqual(runtime);
          expect(yield* fs.exists(`${runtime.directory}/using`)).toBe(false);
        }).pipe(Effect.provide(nodeServicesLayer))
    );
  }

  it.live("preserves a cache redirected outside the checkout", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      yield* fs.makeDirectory(`${root}/shared`);
      yield* fs.symlink(`${root}/shared`, `${root}/.cache`);
      expect(yield* reserveLocalRuntime(root).pipe(Effect.flip)).toMatchObject({
        _tag: "AcceptanceRuntimeError",
      });
      expect(yield* fs.exists(`${root}/shared/acceptance`)).toBe(false);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live("preserves a replaced reservation before cleanup", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const reserved = yield* reserveLocalRuntime(root);
      yield* fs.rename(reserved.directory, `${root}/original`);
      yield* fs.makeDirectory(reserved.directory);
      expect(
        yield* releaseLocalRuntime(reserved).pipe(Effect.flip)
      ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
      expect(yield* fs.exists(reserved.directory)).toBe(true);
    }).pipe(Effect.provide(nodeServicesLayer))
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
        ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
        expect(yield* fs.exists(reserved.directory)).toBe(true);
        expect(yield* fs.exists(`${root}/original`)).toBe(true);
      }).pipe(Effect.provide(nodeServicesLayer))
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
            yield* initializeLocalRuntime(root);
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
              ? initializeLocalRuntime(root)
              : readLocalRuntime(root);
          expect(
            yield* program.pipe(
              Effect.provideService(FileSystem.FileSystem, reader),
              Effect.flip
            )
          ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
          yield* releaseLocalRuntime(reserved);
        }).pipe(Effect.provide(nodeServicesLayer))
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
    "signing-key",
  ]) {
    it.live(`preserves a runtime after its ${change} changes`, () =>
      Effect.gen(function* () {
        initialize();
        const { fs, root } = yield* fixture;
        yield* reserveLocalRuntime(root);
        const runtime = yield* initializeLocalRuntime(root);
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
        if (change === "signing-key") {
          yield* fs.chmod(runtime.signing.privateKeyPath, 0o644);
        }
        if (change === "manifest") {
          yield* fs.writeFileString(manifest, "{}");
        }
        if (change === "database") {
          yield* fs.writeFileString(
            manifest,
            yield* encodeManifest({ ...runtime, databaseInode: -1 })
          );
        }
        if (change === "directory") {
          yield* fs.writeFileString(
            manifest,
            yield* encodeManifest({ ...runtime, directory: "foreign" })
          );
        }
        if (change === "foreign-backend") {
          yield* fs.writeFileString(
            manifest,
            yield* encodeManifest({ ...runtime, backend: "foreign" })
          );
        }
        if (change === "foreign-inode") {
          yield* fs.writeFileString(
            manifest,
            yield* encodeManifest({ ...runtime, directoryInode: -1 })
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
          _tag: "AcceptanceRuntimeError",
        });
        expect(yield* fs.exists(runtime.directory)).toBe(true);
      }).pipe(Effect.provide(nodeServicesLayer))
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
            yield* initializeLocalRuntime(root).pipe(Effect.flip)
          ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
          yield* releaseLocalRuntime(reserved);
        }).pipe(Effect.provide(nodeServicesLayer))
    );
  }
});
