import { NodeSocketServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { reserveAnalyticsOrigin } from "@repo/backend/scripts/content/acceptance/analytics";
import {
  type LocalRuntime,
  LocalRuntimeJson,
} from "@repo/backend/scripts/content/acceptance/local";
import { createLocalSigningIdentity } from "@repo/backend/scripts/content/acceptance/signing";
import {
  preparedKey,
  restorePrepared,
  savePrepared,
  snapshotStore,
} from "@repo/backend/scripts/content/acceptance/snapshot";
import { nodePlatform } from "@repo/backend/test/platform";
import {
  ConfigProvider,
  Effect,
  FileSystem,
  Layer,
  Option,
  Schema,
} from "effect";
import { ChildProcess } from "effect/process";

/** Runs one Git command in a fixture checkout. */
const git = Effect.fn("SnapshotTest.git")(function* (
  cwd: string,
  ...args: readonly string[]
) {
  const child = yield* ChildProcess.make("git", args, {
    cwd,
    stderr: "ignore",
    stdout: "ignore",
  });
  expect(yield* child.exitCode).toBe(0);
}, Effect.scoped);

const json = (value: unknown) => JSON.stringify(value);

/**
 * A checkout whose backend depends on two workspaces, one of them twice, and on
 * a workspace name that no folder holds. The design workspace and a folder
 * without a manifest are no inputs of the backend.
 */
const checkout = Effect.fn("SnapshotTest.checkout")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "snapshot-" });
  const files = {
    ".gitignore": "ignored.txt\n",
    "bun.lock": "lock 1\n",
    "package.json": json({
      workspaces: { packages: ["apps/*", "packages/*"] },
    }),
    "apps/www/package.json": json({
      name: "www",
      dependencies: { "@repo/backend": "workspace:*" },
    }),
    "apps/www/page.tsx": "page 1\n",
    "packages/backend/package.json": json({
      name: "@repo/backend",
      dependencies: {
        "@repo/contents": "workspace:*",
        "@repo/missing": "workspace:*",
        "@repo/utilities": "workspace:*",
        effect: "4.1.2",
      },
    }),
    "packages/backend/source.json": json({ revision: "a" }),
    "packages/backend/schema.ts": "schema 1\n",
    "packages/contents/package.json": json({
      name: "@repo/contents",
      dependencies: { "@repo/utilities": "workspace:*" },
    }),
    "packages/contents/contract.ts": "contract 1\n",
    "packages/utilities/package.json": json({ name: "@repo/utilities" }),
    "packages/utilities/digest.ts": "digest 1\n",
    "packages/design/package.json": json({ name: "@repo/design" }),
    "packages/design/button.tsx": "button 1\n",
    "packages/loose/notes.md": "notes\n",
  };
  for (const [path, text] of Object.entries(files)) {
    yield* fs.makeDirectory(`${root}/${path}`.replace(/\/[^/]+$/u, ""), {
      recursive: true,
    });
    yield* fs.writeFileString(`${root}/${path}`, text);
  }
  yield* git(root, "init", "--quiet");
  yield* git(root, "add", "--all");
  const renderer = `${root}/renderer.json`;
  yield* fs.writeFileString(renderer, "renderer 1\n");
  return { root, renderer };
});

const ORIGIN = "http://localhost:3000";

describe("prepared runtime key", () => {
  it.effect(
    "changes with every input of the prepared state and with nothing else",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { root, renderer } = yield* checkout();
        const key = () => preparedKey(root, renderer, ORIGIN);
        const first = yield* key();
        expect(first).toMatch(/^[0-9a-f]{64}$/u);
        expect(yield* key()).toBe(first);

        // Files outside the backend's workspaces, and files Git ignores, are no inputs.
        yield* fs.writeFileString(`${root}/apps/www/page.tsx`, "page 2\n");
        yield* fs.writeFileString(`${root}/packages/design/button.tsx`, "2\n");
        yield* fs.writeFileString(`${root}/packages/backend/ignored.txt`, "x");
        expect(yield* key()).toBe(first);

        const seen = new Set([first]);
        const changes = [
          () => fs.writeFileString(`${root}/packages/backend/schema.ts`, "2\n"),
          () =>
            fs.writeFileString(
              `${root}/packages/backend/source.json`,
              json({ revision: "b" })
            ),
          () =>
            fs.writeFileString(`${root}/packages/utilities/digest.ts`, "2\n"),
          () => fs.writeFileString(`${root}/packages/contents/new.ts`, "new\n"),
          () => fs.remove(`${root}/packages/contents/contract.ts`),
          () => fs.writeFileString(`${root}/bun.lock`, "lock 2\n"),
          () => fs.writeFileString(renderer, "renderer 2\n"),
        ];
        for (const change of changes) {
          yield* change();
          const next = yield* key();
          expect(seen.has(next)).toBe(false);
          seen.add(next);
        }
        const moved = yield* preparedKey(root, renderer, "http://localhost:3001");
        expect(seen.has(moved)).toBe(false);
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses a key outside a Git checkout", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { root, renderer } = yield* checkout();
      yield* fs.remove(`${root}/.git`, { recursive: true });
      expect(
        (yield* preparedKey(root, renderer, ORIGIN).pipe(Effect.flip)).message
      ).toContain("git ls-files exited");
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );
});

describe("prepared runtime store", () => {
  it.effect("names ACCEPTANCE_SNAPSHOTS, else the user's cache", () =>
    Effect.gen(function* () {
      const read = (env: Record<string, string>) =>
        snapshotStore.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord(env)
          )
        );
      expect(yield* read({ ACCEPTANCE_SNAPSHOTS: "/ci", HOME: "/home" })).toBe(
        "/ci"
      );
      expect(yield* read({ HOME: "/home" })).toBe(
        "/home/.cache/nakafa/acceptance"
      );
      expect((yield* read({}).pipe(Effect.flip)).message).toContain(
        "ACCEPTANCE_SNAPSHOTS"
      );
    })
  );
});

/** A stopped prepared runtime with a real signing identity, saved under `<root>/.cache/acceptance`. */
const preparedRuntime = Effect.fn("SnapshotTest.preparedRuntime")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "prepared-" });
  const directory = yield* fs.realPath(
    yield* fs
      .makeDirectory(`${root}/.cache/acceptance`, { recursive: true })
      .pipe(Effect.as(`${root}/.cache/acceptance`))
  );
  const identity = yield* createLocalSigningIdentity(directory);
  const backend = `${directory}/backend`;
  yield* fs.makeDirectory(`${backend}/.convex/local/default`, {
    recursive: true,
  });
  yield* fs.writeFileString(
    `${backend}/.convex/local/default/config.json`,
    "{}"
  );
  yield* fs.writeFileString(`${backend}/.env.local`, "VITE_CONVEX_URL=x\n");
  yield* fs.writeFileString(`${backend}/convex.json`, "{}");
  yield* fs.writeFileString(`${directory}/source.log`, "left behind");
  const [query, site, analytics] = [
    yield* reserveAnalyticsOrigin(),
    yield* reserveAnalyticsOrigin(),
    yield* reserveAnalyticsOrigin(),
  ];
  const runtime: LocalRuntime = {
    ...identity,
    analytics,
    app: ORIGIN,
    backend,
    configurationHash: "config",
    databaseInode: Option.getOrThrow(
      (yield* fs.stat(`${backend}/.convex`)).ino
    ),
    directory,
    directoryInode: Option.getOrThrow((yield* fs.stat(directory)).ino),
    environmentHash: "environment",
    query,
    site,
  };
  yield* fs.writeFileString(
    `${directory}/manifest.json`,
    yield* Schema.encodeEffect(LocalRuntimeJson)(runtime)
  );
  return runtime;
});

/** A second checkout whose runtime directory prepare has just reserved. */
const reservedCheckout = Effect.fn("SnapshotTest.reservedCheckout")(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const root = yield* fs.realPath(
      yield* fs.makeTempDirectoryScoped({ prefix: "restore-" })
    );
    const directory = `${root}/.cache/acceptance`;
    yield* fs.makeDirectory(directory, { recursive: true, mode: 0o700 });
    const reservation = {
      directory,
      directoryInode: Option.getOrThrow((yield* fs.stat(directory)).ino),
    };
    return { root, reservation };
  }
);

const KEY = "1".repeat(64);
const OTHER_KEY = "2".repeat(64);

describe("prepared runtime snapshots", () => {
  it.effect(
    "restores a saved runtime into another checkout with its own paths and inodes",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const runtime = yield* preparedRuntime();
        const store = yield* fs.makeTempDirectoryScoped({ prefix: "store-" });
        yield* savePrepared(store, KEY, runtime);
        expect(yield* fs.exists(`${store}/${KEY}/source.log`)).toBe(false);
        // A second save of the same key keeps the first copy.
        yield* savePrepared(store, KEY, runtime);
        expect(yield* fs.readDirectory(store)).toEqual([KEY]);

        const { root, reservation } = yield* reservedCheckout();
        const restored = Option.getOrThrow(
          yield* restorePrepared(store, KEY, root, reservation)
        );
        const backend = `${reservation.directory}/backend`;
        expect(restored).toMatchObject({
          analytics: runtime.analytics,
          app: runtime.app,
          backend,
          directory: reservation.directory,
          directoryInode: reservation.directoryInode,
          publicationToken: runtime.publicationToken,
          query: runtime.query,
          signing: {
            keyId: runtime.signing.keyId,
            privateKeyPath: `${reservation.directory}/signing-private.pem`,
            publicKeyPem: runtime.signing.publicKeyPem,
          },
        });
        expect(restored.databaseInode).toBe(
          Option.getOrThrow((yield* fs.stat(`${backend}/.convex`)).ino)
        );
        expect(
          yield* fs
            .readFileString(`${reservation.directory}/manifest.json`)
            .pipe(Effect.flatMap(Schema.decodeEffect(LocalRuntimeJson)))
        ).toEqual(restored);
        expect(yield* fs.readLink(`${backend}/node_modules`)).toBe(
          `${root}/packages/backend/node_modules`
        );
        expect(yield* fs.readFileString(`${backend}/.env.local`)).toBe(
          "VITE_CONVEX_URL=x\n"
        );
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("never restores the state of another key", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtime = yield* preparedRuntime();
      const store = yield* fs.makeTempDirectoryScoped({ prefix: "store-" });
      yield* savePrepared(store, KEY, runtime);
      const { root, reservation } = yield* reservedCheckout();
      expect(
        yield* restorePrepared(store, OTHER_KEY, root, reservation)
      ).toEqual(Option.none());
      expect(yield* fs.readDirectory(reservation.directory)).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses a restore whose saved ports another process holds", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtime = yield* preparedRuntime();
      const store = yield* fs.makeTempDirectoryScoped({ prefix: "store-" });
      yield* savePrepared(store, KEY, runtime);
      yield* NodeSocketServer.make({
        host: "127.0.0.1",
        port: Number(new URL(runtime.query).port),
      });
      const { root, reservation } = yield* reservedCheckout();
      expect(
        (yield* restorePrepared(store, KEY, root, reservation).pipe(
          Effect.flip
        )).message
      ).toContain("is occupied");
      expect(yield* fs.exists(`${reservation.directory}/manifest.json`)).toBe(
        false
      );
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("keeps only the newest snapshots of a store", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtime = yield* preparedRuntime();
      const store = yield* fs.makeTempDirectoryScoped({ prefix: "store-" });
      const keys = ["a", "b", "c", "d"].map((letter) => letter.repeat(64));
      for (const [index, key] of keys.entries()) {
        yield* savePrepared(store, key, runtime);
        yield* fs.utimes(`${store}/${key}`, index * 1000, index * 1000);
      }
      yield* fs.writeFileString(`${store}/README`, "not a snapshot");
      yield* savePrepared(store, "e".repeat(64), runtime);
      expect((yield* fs.readDirectory(store)).sort()).toEqual(
        ["README", ...keys.slice(2), "e".repeat(64)].sort()
      );
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );
});

/** The Node file system with some operations replaced, for the races and platforms a real disk does not show. */
const patchedFileSystem = (
  patch: (fs: FileSystem.FileSystem) => Partial<FileSystem.FileSystem>
) =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.map(FileSystem.FileSystem, (fs) => ({ ...fs, ...patch(fs) }))
  ).pipe(Layer.provide(nodePlatform));

describe("prepared runtime snapshot edges", () => {
  it.effect("keeps the copy of a proof that saved the same key first", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtime = yield* preparedRuntime();
      const store = yield* fs.makeTempDirectoryScoped({ prefix: "store-" });
      yield* savePrepared(store, KEY, runtime).pipe(
        Effect.provide(
          patchedFileSystem((real) => ({
            rename: (from, to) =>
              real
                .makeDirectory(to)
                .pipe(
                  Effect.andThen(real.writeFileString(`${to}/first`, "first")),
                  Effect.andThen(real.rename(from, to))
                ),
          }))
        )
      );
      expect(yield* fs.readDirectory(store)).toEqual([KEY]);
      expect(yield* fs.readDirectory(`${store}/${KEY}`)).toEqual(["first"]);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("fails a save whose rename fails with no copy in place", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtime = yield* preparedRuntime();
      const store = yield* fs.makeTempDirectoryScoped({ prefix: "store-" });
      const failure = yield* savePrepared(store, KEY, runtime).pipe(
        Effect.provide(
          patchedFileSystem((real) => ({
            rename: (from) => real.rename(from, `${store}/missing/${KEY}`),
          }))
        ),
        Effect.flip
      );
      expect(failure._tag).toBe("PlatformError");
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect(
    "refuses a restore on a disk without inodes and evicts by age zero without times",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const runtime = yield* preparedRuntime();
        const store = yield* fs.makeTempDirectoryScoped({ prefix: "store-" });
        const timeless = patchedFileSystem((real) => ({
          stat: (path) =>
            real
              .stat(path)
              .pipe(
                Effect.map((info) => ({
                  ...info,
                  ino: Option.none(),
                  mtime: Option.none(),
                }))
              ),
        }));
        for (const key of ["a", "b", "c", "d"]) {
          yield* savePrepared(store, key.repeat(64), runtime).pipe(
            Effect.provide(timeless)
          );
        }
        expect(yield* fs.readDirectory(store)).toHaveLength(3);
        const [kept] = yield* fs.readDirectory(store);
        const { root, reservation } = yield* reservedCheckout();
        expect(
          (yield* restorePrepared(store, kept ?? "", root, reservation).pipe(
            Effect.provide(timeless),
            Effect.flip
          )).message
        ).toContain("no filesystem identity");
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );
});
