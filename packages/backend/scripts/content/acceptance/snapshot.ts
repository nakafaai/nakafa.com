import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  type LocalRuntime,
  LocalRuntimeJson,
  linkBackendPackage,
} from "@repo/backend/scripts/content/acceptance/local";
import { assertLocalPortsFree } from "@repo/backend/scripts/content/acceptance/process";
import { verifyLocalSigningIdentity } from "@repo/backend/scripts/content/acceptance/signing";
import { sha256, sha256Hex } from "@repo/utilities/digest";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Clock,
  Config,
  Effect,
  FileSystem,
  HashMap,
  HashSet,
  Option,
  Order,
  Record as Rec,
  Schema,
  Stream,
} from "effect";
import { Hex } from "effect/encoding";
import { ChildProcess } from "effect/process";

/**
 * A prepared runtime is the local database after prepare: the schema, the
 * seeded acceptance release and the signing identity that published it. What it
 * holds depends only on the backend's code, the workspaces that code imports,
 * the dependency versions, the pinned Aksara revision (`source.json`, inside
 * `packages/backend`), the renderer manifest the publication reads and the app
 * origin baked into `SITE_URL`. Its key hashes all of them, so a change to any
 * one prepares again, and an unchanged key restores the snapshot instead of
 * repeating codegen, the first push and the publication. Every start still
 * pushes the current functions, so the snapshot never serves stale code.
 */
const WorkspacePatterns = Schema.fromJsonString(
  Schema.Struct({
    workspaces: Schema.Struct({
      packages: Schema.Array(
        Schema.String.check(Schema.isPattern(/^[a-z]+\/\*$/u))
      ),
    }),
  })
);

const PackageManifest = Schema.fromJsonString(
  Schema.Struct({
    name: Schema.String,
    dependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  })
);

/** The package whose prepared state a snapshot keeps. */
const BACKEND_PACKAGE = "@repo/backend";

/** The root files that pin every dependency version, the catalog included. */
const LOCK_FILES = ["package.json", "bun.lock"] as const;

/**
 * The files of a prepared runtime that a snapshot keeps, relative to the runtime
 * directory. The Aksara checkout, the logs and the lease stay behind, and the
 * links to the checkout's backend package are made again on restore.
 */
const SNAPSHOT_FILES = [
  "signing-private.pem",
  "backend/.convex",
  "backend/.env.local",
  "backend/convex.json",
] as const;

/** The name of a saved snapshot: its key. A partial copy carries a suffix. */
const SNAPSHOT_NAME = /^[0-9a-f]{64}$/u;

/** How many snapshots a store keeps: each holds one database of about 150 MB. */
const SNAPSHOT_LIMIT = 3;

/** Workspace dependencies that one package names, which a closure walks next. */
const workspaceDependencies = (
  manifest: typeof PackageManifest.Type
): readonly string[] =>
  Arr.map(
    Arr.filter(Rec.toEntries(manifest.dependencies ?? {}), ([, version]) =>
      version.startsWith("workspace:")
    ),
    ([name]) => name
  );

/** Every package that the pending names reach through workspace dependencies. */
const reach = (
  manifests: HashMap.HashMap<string, typeof PackageManifest.Type>,
  pending: readonly string[],
  seen: HashSet.HashSet<string>
): HashSet.HashSet<string> => {
  const [next, ...rest] = pending;
  if (next === undefined) {
    return seen;
  }
  if (HashSet.has(seen, next)) {
    return reach(manifests, rest, seen);
  }
  const children = Option.match(HashMap.get(manifests, next), {
    onNone: () => [],
    onSome: workspaceDependencies,
  });
  return reach(manifests, [...rest, ...children], HashSet.add(seen, next));
};

/** The folders of the backend package and of every workspace it depends on. */
const backendFolders = Effect.fn("contentAcceptance.backendFolders")(function* (
  root: string
) {
  const fs = yield* FileSystem.FileSystem;
  const { workspaces } = yield* fs
    .readFileString(`${root}/package.json`)
    .pipe(Effect.flatMap(Schema.decodeEffect(WorkspacePatterns)));
  const folders = yield* Effect.forEach(workspaces.packages, (pattern) => {
    const parent = pattern.slice(0, -2);
    return fs
      .readDirectory(`${root}/${parent}`)
      .pipe(Effect.map(Arr.map((name) => `${parent}/${name}`)));
  }).pipe(Effect.map(Arr.flatten));
  const packages = yield* Effect.forEach(
    folders,
    Effect.fn(function* (folder) {
      const path = `${root}/${folder}/package.json`;
      if (!(yield* fs.exists(path))) {
        return Option.none();
      }
      const manifest = yield* fs
        .readFileString(path)
        .pipe(Effect.flatMap(Schema.decodeEffect(PackageManifest)));
      return Option.some({ folder, manifest });
    })
  ).pipe(Effect.map(Arr.getSomes));
  const manifests = HashMap.fromIterable(
    Arr.map(packages, ({ manifest }) => [manifest.name, manifest] as const)
  );
  const reached = reach(manifests, [BACKEND_PACKAGE], HashSet.empty());
  return Arr.sort(
    Arr.map(
      Arr.filter(packages, ({ manifest }) =>
        HashSet.has(reached, manifest.name)
      ),
      ({ folder }) => folder
    ),
    Order.String
  );
});

/** The files of the given paths that Git does not ignore, committed or not, in path order. */
const gitFiles = Effect.fn("contentAcceptance.gitFiles")(function* (
  root: string,
  paths: readonly string[]
) {
  const child = yield* ChildProcess.make(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ...paths,
    ],
    { cwd: root, stderr: "ignore", stdin: "ignore" }
  );
  const [text, code] = yield* Effect.all(
    [child.stdout.pipe(Stream.decodeText(), Stream.mkString), child.exitCode],
    { concurrency: "unbounded" }
  );
  if (code !== 0) {
    return yield* acceptanceRuntimeError(
      `git ls-files exited with code ${code}, so the prepared runtime has no key.`
    );
  }
  return Arr.sort(
    Arr.dedupe(Arr.filter(text.split("\0"), (path) => path !== "")),
    Order.String
  );
}, Effect.scoped);

/**
 * The key of the prepared runtime that this checkout would create: the SHA-256
 * of every input listed above. A file that Git lists but the working tree has
 * deleted is no input, so a deletion changes the key too.
 */
export const preparedKey = Effect.fn("contentAcceptance.preparedKey")(
  function* (root: string, renderer: string, origin: string) {
    const fs = yield* FileSystem.FileSystem;
    const folders = yield* backendFolders(root);
    const files = yield* gitFiles(root, [...folders, ...LOCK_FILES]);
    const lines = yield* Effect.forEach(
      files,
      Effect.fn(function* (file) {
        const path = `${root}/${file}`;
        if (!(yield* fs.exists(path))) {
          return Option.none();
        }
        const digest = yield* sha256(yield* fs.readFile(path));
        return Option.some(`${Hex.encode(digest)} ${file}`);
      }),
      { concurrency: 16 }
    ).pipe(Effect.map(Arr.getSomes));
    return yield* sha256Hex(
      Arr.join(
        [
          ...lines,
          `renderer ${yield* sha256Hex(yield* fs.readFileString(renderer))}`,
          `origin ${origin}`,
        ],
        "\n"
      )
    );
  }
);

/**
 * Where prepared runtimes wait between proofs: the folder that
 * `ACCEPTANCE_SNAPSHOTS` names, which a CI job restores and saves with its
 * cache, or a folder in the user's cache that every checkout of this Mac shares.
 */
export const snapshotStore = Config.NonEmptyString("ACCEPTANCE_SNAPSHOTS").pipe(
  Config.orElse(() =>
    Config.NonEmptyString("HOME").pipe(
      Config.map((home) => `${home}/.cache/nakafa/acceptance`)
    )
  ),
  Effect.mapError(() =>
    acceptanceRuntimeError(
      "Set ACCEPTANCE_SNAPSHOTS or HOME, so prepared runtimes have a store."
    )
  )
);

/** The reserved runtime directory that a restore fills. */
const Reservation = Schema.Struct({
  directory: Schema.String,
  directoryInode: Schema.BigInt,
});
type Reservation = typeof Reservation.Type;

/**
 * Restores the prepared runtime of this key into the reserved directory, or
 * returns nothing when the store has none. The restored runtime records its own
 * paths and inodes, so the ownership checks of every later build and start hold.
 */
export const restorePrepared = Effect.fn("contentAcceptance.restorePrepared")(
  function* (
    store: string,
    key: string,
    root: string,
    reservation: Reservation
  ) {
    const fs = yield* FileSystem.FileSystem;
    const snapshot = `${store}/${key}`;
    if (!(yield* fs.exists(`${snapshot}/manifest.json`))) {
      return Option.none<LocalRuntime>();
    }
    const { directory } = reservation;
    const backend = `${directory}/backend`;
    yield* fs.makeDirectory(backend, { mode: 0o700 });
    yield* Effect.forEach(SNAPSHOT_FILES, (file) =>
      fs.copy(`${snapshot}/${file}`, `${directory}/${file}`)
    );
    yield* linkBackendPackage(root, backend);
    const privateKeyPath = `${directory}/signing-private.pem`;
    yield* fs.chmod(privateKeyPath, 0o600);
    const saved = yield* fs
      .readFileString(`${snapshot}/manifest.json`)
      .pipe(Effect.flatMap(Schema.decodeEffect(LocalRuntimeJson)));
    const database = yield* fs.stat(`${backend}/.convex`);
    const privateKey = yield* fs.stat(privateKeyPath);
    if (Option.isNone(database.ino) || Option.isNone(privateKey.ino)) {
      return yield* acceptanceRuntimeError(
        "The restored runtime has no filesystem identity."
      );
    }
    const runtime: LocalRuntime = {
      ...saved,
      ...reservation,
      backend,
      databaseInode: database.ino.value,
      signing: {
        ...saved.signing,
        privateKeyPath,
        privateKeyInode: privateKey.ino.value,
      },
    };
    yield* verifyLocalSigningIdentity(directory, runtime.signing);
    yield* assertLocalPortsFree(runtime);
    yield* fs.writeFileString(
      `${directory}/manifest.json`,
      yield* Schema.encodeEffect(LocalRuntimeJson)(runtime),
      { mode: 0o600, flag: "wx" }
    );
    const now = yield* Clock.currentTimeMillis;
    yield* fs.utimes(snapshot, now, now);
    return Option.some(runtime);
  }
);

/** Removes every snapshot of the store past the newest `SNAPSHOT_LIMIT`, so the disk keeps a few. */
const evictSnapshots = Effect.fn("contentAcceptance.evictSnapshots")(function* (
  store: string
) {
  const fs = yield* FileSystem.FileSystem;
  const names = yield* fs.readDirectory(store);
  const dated = yield* Effect.forEach(
    Arr.filter(names, (name) => SNAPSHOT_NAME.test(name)),
    Effect.fn(function* (name) {
      const info = yield* fs.stat(`${store}/${name}`);
      const time = Option.getOrElse(
        Option.map(info.mtime, (date) => date.getTime()),
        () => 0
      );
      return { name, time };
    })
  );
  const newestFirst = Arr.sort(
    dated,
    Order.flip(
      Order.mapInput(
        Order.Number,
        (entry: { readonly time: number }) => entry.time
      )
    )
  );
  yield* Effect.forEach(Arr.drop(newestFirst, SNAPSHOT_LIMIT), ({ name }) =>
    fs.remove(`${store}/${name}`, { recursive: true })
  );
});

/**
 * Saves a stopped prepared runtime under its key. It copies into a private
 * folder first and renames it into place, so a reader never sees half a
 * snapshot; when another proof saved the same key first, its copy stays.
 */
export const savePrepared = Effect.fn("contentAcceptance.savePrepared")(
  function* (store: string, key: string, runtime: LocalRuntime) {
    const fs = yield* FileSystem.FileSystem;
    const target = `${store}/${key}`;
    yield* fs.makeDirectory(store, { recursive: true, mode: 0o700 });
    if (yield* fs.exists(target)) {
      return;
    }
    const partial = `${store}/${key}.${yield* randomUuid}`;
    yield* fs.makeDirectory(`${partial}/backend`, {
      recursive: true,
      mode: 0o700,
    });
    yield* Effect.forEach(SNAPSHOT_FILES, (file) =>
      fs.copy(`${runtime.directory}/${file}`, `${partial}/${file}`)
    );
    yield* fs.copyFile(
      `${runtime.directory}/manifest.json`,
      `${partial}/manifest.json`
    );
    yield* fs
      .rename(partial, target)
      .pipe(
        Effect.catchTag("PlatformError", (error) =>
          fs
            .exists(target)
            .pipe(
              Effect.flatMap((saved) =>
                saved
                  ? fs.remove(partial, { recursive: true })
                  : Effect.fail(error)
              )
            )
        )
      );
    yield* evictSnapshots(store);
  }
);
