import { createHash } from "node:crypto";
import { relative } from "node:path";
import { parseEnv } from "node:util";
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  assertLocalPortsFree,
  localConvexEnvironment,
} from "@repo/backend/scripts/content/acceptance/process";
import {
  createLocalSigningIdentity,
  LocalSigningIdentitySchema,
  verifyLocalSigningIdentity,
} from "@repo/backend/scripts/content/acceptance/signing";
import { Effect, FileSystem, Option, Schema } from "effect";

const LoopbackUrl = Schema.String.check(
  Schema.isPattern(/^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/),
  Schema.makeFilter(
    (value) => Number(value.slice(value.lastIndexOf(":") + 1)) <= 65_535
  )
);
const RuntimeManifest = Schema.Struct({
  backend: Schema.String,
  configurationHash: Schema.String,
  databaseInode: Schema.Finite,
  directory: Schema.String,
  directoryInode: Schema.Finite,
  environmentHash: Schema.String,
  query: LoopbackUrl,
  publicationToken: Schema.String,
  signing: LocalSigningIdentitySchema,
  site: LoopbackUrl,
});
export type LocalRuntime = typeof RuntimeManifest.Type;
export const LOCAL_RUNTIME_TOKEN = "acceptance-local-runtime";

/** One inert backend environment for signed reads in local production builds. */
const localEnvironment = {
  AI_GATEWAY_API_KEY: "build-disabled",
  AUTH_GOOGLE_ID: "build-disabled",
  AUTH_GOOGLE_SECRET: "build-disabled",
  BETTER_AUTH_SECRET: "build-inert-secret-00000000",
  CONTENT_RUNTIME_TOKEN: LOCAL_RUNTIME_TOKEN,
  FIRECRAWL_API_KEY: "build-disabled",
  JWKS: "[]",
  [NAKAFA_API_EDGE_CONTRACT.secretEnvironment]: "build-api-edge-secret",
  [NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment]: "build-mcp-edge-secret",
  NEXT_PUBLIC_POLAR_SERVER: "sandbox",
  OPENWEATHER_API_KEY: "build-disabled",
  POLAR_ACCESS_TOKEN: "build-disabled",
  POLAR_WEBHOOK_SECRET: "build-disabled",
  POSTHOG_ERASURE_API_KEY: "build-disabled",
  POSTHOG_HOST: "https://example.invalid",
  POSTHOG_PROJECT_ID: "0",
  POSTHOG_PROJECT_TOKEN: "build-disabled",
  RESEND_API_KEY: "build-disabled",
  RESEND_WEBHOOK_SECRET: "build-disabled",
  SITE_URL: "http://localhost:3000",
};

/** Returns child-only app values; no application environment file is written. */
export function localApplicationEnvironment(runtime: LocalRuntime) {
  return {
    ...localConvexEnvironment,
    AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
    AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
    AKSARA_PUBLICATION_TOKEN: runtime.publicationToken,
    CONTENT_RUNTIME_TOKEN: LOCAL_RUNTIME_TOKEN,
    CONVEX_AGENT_MODE: "anonymous",
    CONVEX_SITE_URL: runtime.site,
    CONVEX_URL: runtime.query,
    NAKAFA_CONVEX_SITE_URL: runtime.site,
    NEXT_PUBLIC_CONVEX_SITE_URL: runtime.site,
    NEXT_PUBLIC_CONVEX_URL: runtime.query,
    [NAKAFA_API_EDGE_CONTRACT.secretEnvironment]:
      localEnvironment[NAKAFA_API_EDGE_CONTRACT.secretEnvironment],
    [NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment]:
      localEnvironment[NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment],
  };
}

const directoryIdentity = Effect.fn("contentAcceptance.directoryIdentity")(
  function* (directory: string) {
    const fs = yield* FileSystem.FileSystem;
    const info = yield* fs.stat(directory);
    if (
      info.type !== "Directory" ||
      Option.isNone(info.ino) ||
      (yield* fs.realPath(directory)) !== directory
    ) {
      return yield* acceptanceRuntimeError(
        "The local runtime directory changed ownership."
      );
    }
    return { directory, directoryInode: info.ino.value };
  }
);

/** Reserves one private runtime without changing the checkout's Convex selection. */
export const reserveLocalRuntime = Effect.fn(
  "contentAcceptance.reserveLocalRuntime"
)(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(`${root}/.cache`, { recursive: true });
  if ((yield* fs.realPath(`${root}/.cache`)) !== `${root}/.cache`) {
    return yield* acceptanceRuntimeError(
      "The build cache must belong to this checkout."
    );
  }
  const directory = `${root}/.cache/acceptance`;
  yield* fs
    .makeDirectory(directory, { mode: 0o700 })
    .pipe(
      Effect.mapError(() =>
        acceptanceRuntimeError(
          "The build runtime already exists or is not writable. Stop it and run pnpm acceptance:clean before preparing another fixture."
        )
      )
    );
  return yield* directoryIdentity(directory);
});

/** Removes only the directory reserved by this lifecycle, after children stop. */
export const releaseLocalRuntime = Effect.fn(
  "contentAcceptance.releaseLocalRuntime"
)(function* (runtime: Effect.Success<ReturnType<typeof reserveLocalRuntime>>) {
  const fs = yield* FileSystem.FileSystem;
  const actual = yield* directoryIdentity(runtime.directory);
  if (actual.directoryInode !== runtime.directoryInode) {
    return yield* acceptanceRuntimeError(
      "The local runtime directory changed ownership; it is preserved."
    );
  }
  yield* fs.remove(runtime.directory, { recursive: true });
});

/** Initializes one anonymous deployment and records the exact state owned by this acceptance run. */
export const initializeLocalRuntime = Effect.fn(
  "contentAcceptance.initializeLocalRuntime"
)(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = `${root}/.cache/acceptance`;
  const reserved = yield* directoryIdentity(directory);
  const identity = yield* createLocalSigningIdentity(directory);
  const backend = `${directory}/backend`;
  yield* fs.makeDirectory(backend, { mode: 0o700 });
  // Convex owns this open configuration. Preserve its fields and use the real source path for component identity.
  const config = yield* fs
    .readFileString(`${root}/packages/backend/convex.json`)
    .pipe(
      Effect.flatMap(
        Schema.decodeEffect(
          Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))
        )
      )
    );
  yield* fs.writeFileString(
    `${backend}/convex.json`,
    JSON.stringify({
      ...config,
      functions: relative(backend, `${root}/packages/backend/convex`),
    })
  );
  for (const entry of ["node_modules", "package.json"]) {
    yield* fs.symlink(
      `${root}/packages/backend/${entry}`,
      `${backend}/${entry}`
    );
  }
  const command = Effect.fn("contentAcceptance.configureLocal")(function* (
    args: readonly string[],
    stdin?: string
  ) {
    yield* runAcceptanceCommand({
      args: ["exec", "convex", ...args],
      command: "pnpm",
      cwd: backend,
      env: localConvexEnvironment,
      operation: `Anonymous Convex ${args[0]}`,
      reportStderr: true,
      stderrPath: `${directory}/setup.log`,
      stdoutPath: `${directory}/setup.log`,
      stdin,
    });
  });
  yield* command(["init"]);
  const source = yield* fs.readFileString(`${backend}/.env.local`);
  const environment = parseEnv(source);
  const urls = yield* Schema.decodeUnknownEffect(
    Schema.Struct({ query: LoopbackUrl, site: LoopbackUrl })
  )({
    query: environment.VITE_CONVEX_URL,
    site: environment.VITE_CONVEX_SITE_URL,
  }).pipe(
    Effect.mapError(() =>
      acceptanceRuntimeError("Anonymous Convex must provide loopback URLs.")
    )
  );
  if (urls.query === urls.site) {
    return yield* acceptanceRuntimeError(
      "Anonymous Convex query and HTTP ports must differ."
    );
  }
  yield* command(
    ["env", "set", "--force"],
    Object.entries({
      ...localEnvironment,
      AKSARA_AGENT_SIGNING_KEY_ID: identity.signing.keyId,
      AKSARA_AGENT_SIGNING_PUBLIC_KEY: identity.signing.publicKeyPem,
      AKSARA_PUBLICATION_TOKEN: identity.publicationToken,
    })
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n")
  );
  const database = yield* fs.stat(`${backend}/.convex`);
  if (Option.isNone(database.ino)) {
    return yield* acceptanceRuntimeError(
      "The local database has no filesystem identity."
    );
  }
  const runtime: LocalRuntime = {
    ...identity,
    ...reserved,
    ...urls,
    backend,
    databaseInode: database.ino.value,
    configurationHash: createHash("sha256")
      .update(
        yield* fs.readFileString(`${backend}/.convex/local/default/config.json`)
      )
      .digest("hex"),
    environmentHash: createHash("sha256").update(source).digest("hex"),
  };
  yield* fs.writeFileString(
    `${directory}/manifest.json`,
    JSON.stringify(runtime),
    { mode: 0o600, flag: "wx" }
  );
  return runtime;
});

/** Reopens only the unchanged local selection and database created by a successful build. */
export const readLocalRuntime = Effect.fn("contentAcceptance.readLocalRuntime")(
  function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = `${root}/.cache/acceptance`;
    if (!(yield* fs.exists(directory))) {
      return;
    }
    const runtime = yield* fs.readFileString(`${directory}/manifest.json`).pipe(
      Effect.flatMap(
        Schema.decodeEffect(Schema.fromJsonString(RuntimeManifest))
      ),
      Effect.mapError(() =>
        acceptanceRuntimeError(
          "The build runtime manifest is missing or invalid; existing state is preserved."
        )
      )
    );
    const backend = `${directory}/backend`;
    const actual = yield* directoryIdentity(directory);
    const source = yield* fs.readFileString(`${backend}/.env.local`);
    const database = yield* fs.stat(`${backend}/.convex`);
    if (
      runtime.backend !== backend ||
      runtime.directory !== directory ||
      runtime.directoryInode !== actual.directoryInode ||
      (yield* fs.realPath(`${backend}/.convex`)) !== `${backend}/.convex` ||
      (yield* fs.realPath(`${backend}/.env.local`)) !==
        `${backend}/.env.local` ||
      Option.isNone(database.ino) ||
      runtime.databaseInode !== database.ino.value ||
      runtime.configurationHash !==
        createHash("sha256")
          .update(
            yield* fs.readFileString(
              `${backend}/.convex/local/default/config.json`
            )
          )
          .digest("hex") ||
      runtime.environmentHash !==
        createHash("sha256").update(source).digest("hex")
    ) {
      return yield* acceptanceRuntimeError(
        "The local build runtime changed ownership; existing state is preserved."
      );
    }
    yield* verifyLocalSigningIdentity(directory, runtime.signing);
    return runtime;
  }
);

/** Excludes cleanup or another start while this caller owns the retained runtime. */
export const leaseLocalRuntime = Effect.fn(
  "contentAcceptance.leaseLocalRuntime"
)(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const lock = `${root}/.cache/acceptance/using`;
  yield* Effect.acquireRelease(
    fs
      .writeFileString(lock, String(process.pid), { mode: 0o600, flag: "wx" })
      .pipe(
        Effect.mapError(() =>
          acceptanceRuntimeError(
            "The local build runtime is in use; existing state is preserved."
          )
        )
      ),
    () => fs.remove(lock, { force: true }).pipe(Effect.orDie)
  );
});

/** Deletes a stopped runtime only after its recorded filesystem ownership still matches. */
export const cleanLocalRuntime = Effect.fn(
  "contentAcceptance.cleanLocalRuntime"
)(function* (root: string) {
  const runtime = yield* readLocalRuntime(root);
  if (!runtime) {
    return;
  }
  yield* leaseLocalRuntime(root);
  yield* assertLocalPortsFree(runtime);
  yield* releaseLocalRuntime(runtime);
});
