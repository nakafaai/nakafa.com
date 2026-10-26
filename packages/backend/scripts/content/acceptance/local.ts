import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import { reserveAnalyticsOrigin } from "@repo/backend/scripts/content/acceptance/analytics";
import {
  createLocalJwks,
  LOCAL_AUTH_SECRET,
} from "@repo/backend/scripts/content/acceptance/auth";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import {
  acceptanceRuntimeError,
  retryVersionServiceStart,
} from "@repo/backend/scripts/content/acceptance/error";
import { leaseLocalRuntime } from "@repo/backend/scripts/content/acceptance/lease";
import type { AcceptanceMode } from "@repo/backend/scripts/content/acceptance/mode";
import { acceptanceOrigin } from "@repo/backend/scripts/content/acceptance/origin";
import {
  assertLocalPortsFree,
  localConvexEnvironment,
  makeConvexTemporaryRoot,
} from "@repo/backend/scripts/content/acceptance/process";
import {
  createLocalSigningIdentity,
  LocalSigningIdentitySchema,
  verifyLocalSigningIdentity,
} from "@repo/backend/scripts/content/acceptance/signing";
import { sha256Hex } from "@repo/utilities/digest";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Config,
  ConfigProvider,
  Effect,
  FileSystem,
  Option,
  Path,
  Record as Rec,
  Schema,
} from "effect";

const portInRange = Schema.makeFilter(
  (value: string) => Number(value.slice(value.lastIndexOf(":") + 1)) <= 65_535
);
const LoopbackUrl = Schema.String.check(
  Schema.isPattern(/^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/),
  portInRange
);
/** The origin of the served app, as `acceptanceOrigin` names it. */
const AppOrigin = Schema.String.check(
  Schema.isPattern(/^http:\/\/localhost:[1-9][0-9]*$/),
  portInRange
);
const RuntimeManifest = Schema.Struct({
  analytics: LoopbackUrl,
  app: AppOrigin,
  backend: Schema.String,
  configurationHash: Schema.String,
  databaseInode: Schema.BigIntFromString,
  directory: Schema.String,
  directoryInode: Schema.BigIntFromString,
  environmentHash: Schema.String,
  query: LoopbackUrl,
  publicationToken: Schema.String,
  signing: LocalSigningIdentitySchema,
  site: LoopbackUrl,
});
export type LocalRuntime = typeof RuntimeManifest.Type;
/** The runtime manifest as JSON text. Inode numbers are exact bigints, written as decimal strings. */
export const LocalRuntimeJson = Schema.fromJsonString(RuntimeManifest);
const LOCAL_RUNTIME_TOKEN = "acceptance-local-runtime";

/**
 * One inert backend environment for signed reads in local production builds.
 * Google sign-in stays disabled; each runtime adds its own session signing key
 * as `JWKS` and its app origin as `SITE_URL`, so synthetic learners can sign in
 * locally. The acceptance seeds run only where `ACCEPTANCE_SEED` is set, and
 * only this runtime sets it.
 */
const localEnvironment = {
  ACCEPTANCE_SEED: "true",
  GOOGLE_AUTH_CLIENT_ID: "build-disabled",
  GOOGLE_AUTH_CLIENT_SECRET: "build-disabled",
  BETTER_AUTH_SECRET: LOCAL_AUTH_SECRET,
  CONTENT_READ_TOKEN: LOCAL_RUNTIME_TOKEN,
  FIRECRAWL_API_KEY: "build-disabled",
  LOGIN_CARD_SECRET: "acceptance-local-login-card-secret",
  [NAKAFA_API_EDGE_CONTRACT.secretEnvironment]: "build-api-edge-secret",
  [NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment]: "build-mcp-edge-secret",
  OPENWEATHER_API_KEY: "build-disabled",
  POLAR_ACCESS_TOKEN: "build-disabled",
  POLAR_SERVER: "sandbox",
  POLAR_WEBHOOK_SECRET: "build-disabled",
  POSTHOG_ERASURE_API_KEY: "build-disabled",
  POSTHOG_HOST: "https://example.invalid",
  POSTHOG_PROJECT_ID: "0",
  POSTHOG_PROJECT_TOKEN: "build-disabled",
  RESEND_API_KEY: "build-disabled",
  RESEND_WEBHOOK_SECRET: "build-disabled",
  VAULT_ROOT_KEYS: "local:YWNjZXB0YW5jZS1sb2NhbC12YXVsdC1yb290LWtleSE=",
  // Indonesia buys Pro through Xendit here, as it will in production, so a test in
  // Jakarta sees the passes; any call to the Xendit API fails like Polar's.
  BILLING_INDONESIA_RAIL: "xendit",
  XENDIT_API_KEY: "build-disabled",
};

/** Returns child-only app values; no application environment file is written. */
export function localApplicationEnvironment(runtime: LocalRuntime) {
  return {
    ...localConvexEnvironment,
    AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
    AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
    AKSARA_PUBLICATION_TOKEN: runtime.publicationToken,
    CONTENT_READ_TOKEN: LOCAL_RUNTIME_TOKEN,
    CONVEX_AGENT_MODE: "anonymous",
    CONVEX_SITE_URL: runtime.site,
    CONVEX_URL: runtime.query,
    VITE_SITE_URL: runtime.app,
    VITE_CONVEX_SITE_URL: runtime.site,
    VITE_CONVEX_URL: runtime.query,
    VITE_POSTHOG_PROJECT_TOKEN: "phc_local_acceptance",
    VITE_POSTHOG_UI_HOST: runtime.app,
    VITE_POSTHOG_PROXY_HOST: runtime.analytics,
    SITE_URL: runtime.app,
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
          "The build runtime already exists or is not writable. Stop it and run bun run acceptance:clean before preparing another fixture."
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
  const path = yield* Path.Path;
  const directory = `${root}/.cache/acceptance`;
  const app = yield* acceptanceOrigin;
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
    yield* Schema.encodeEffect(JsonTextSchema)({
      ...config,
      functions: path.relative(backend, `${root}/packages/backend/convex`),
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
    const temporaryRoot = yield* makeConvexTemporaryRoot();
    yield* runAcceptanceCommand({
      args: ["node_modules/convex/bin/main.js", ...args],
      command: process.execPath,
      cwd: backend,
      env: { ...localConvexEnvironment, TMPDIR: temporaryRoot },
      operation: `Anonymous Convex ${args[0]}`,
      reportStderr: true,
      stderrPath: `${directory}/setup.log`,
      stdoutPath: `${directory}/setup.log`,
      ...(stdin === undefined ? {} : { stdin }),
    });
  }, Effect.scoped);
  yield* retryVersionServiceStart(command(["init"]));
  const source = yield* fs.readFileString(`${backend}/.env.local`);
  const urls = yield* Config.all({
    query: Config.schema(LoopbackUrl, "VITE_CONVEX_URL"),
    site: Config.schema(LoopbackUrl, "VITE_CONVEX_SITE_URL"),
  })
    .parse(ConfigProvider.fromDotEnvContents(source))
    .pipe(
      Effect.mapError(() =>
        acceptanceRuntimeError("Anonymous Convex must provide loopback URLs.")
      )
    );
  if (urls.query === urls.site) {
    return yield* acceptanceRuntimeError(
      "Anonymous Convex query and HTTP ports must differ."
    );
  }
  const jwks = yield* createLocalJwks();
  yield* retryVersionServiceStart(
    command(
      ["env", "set", "--force"],
      Arr.join(
        [
          ...Arr.map(
            Rec.toEntries({
              ...localEnvironment,
              AKSARA_AGENT_SIGNING_KEY_ID: identity.signing.keyId,
              AKSARA_AGENT_SIGNING_PUBLIC_KEY: identity.signing.publicKeyPem,
              AKSARA_PUBLICATION_TOKEN: identity.publicationToken,
              SITE_URL: app,
            }),
            ([key, value]) => `${key}=${encodeJsonText(value)}`
          ),
          // Convex reads these lines with dotenv, which keeps a double-quoted
          // value's escaped quotes but takes a single-quoted one literally.
          `JWKS='${jwks}'`,
        ],
        "\n"
      )
    )
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
    analytics: yield* reserveAnalyticsOrigin(),
    app,
    backend,
    databaseInode: database.ino.value,
    configurationHash: yield* sha256Hex(
      yield* fs.readFileString(`${backend}/.convex/local/default/config.json`)
    ),
    environmentHash: yield* sha256Hex(source),
  };
  yield* fs.writeFileString(
    `${directory}/manifest.json`,
    yield* Schema.encodeEffect(LocalRuntimeJson)(runtime),
    { mode: 0o600, flag: "wx" }
  );
  return runtime;
});

/**
 * Reopens only the unchanged local selection and database created by a successful
 * build. The caller holds the runtime's lease, so no live run still prepares it.
 */
const readReservedLocalRuntime = Effect.fn(
  "contentAcceptance.readReservedLocalRuntime"
)(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = `${root}/.cache/acceptance`;
  const runtime = yield* fs.readFileString(`${directory}/manifest.json`).pipe(
    Effect.flatMap(Schema.decodeEffect(LocalRuntimeJson)),
    Effect.mapError(() =>
      acceptanceRuntimeError(
        "The build runtime manifest is missing or invalid; existing state is preserved. Stop its services, delete .cache/acceptance, and run bun run acceptance:prepare."
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
    (yield* fs.realPath(`${backend}/.env.local`)) !== `${backend}/.env.local` ||
    Option.isNone(database.ino) ||
    runtime.databaseInode !== database.ino.value ||
    runtime.configurationHash !==
      (yield* sha256Hex(
        yield* fs.readFileString(`${backend}/.convex/local/default/config.json`)
      )) ||
    runtime.environmentHash !== (yield* sha256Hex(source))
  ) {
    return yield* acceptanceRuntimeError(
      "The local build runtime changed ownership; existing state is preserved."
    );
  }
  yield* verifyLocalSigningIdentity(directory, runtime.signing);
  return runtime;
});

/** Reopens the local runtime of this checkout, or returns nothing when none is reserved. */
export const readLocalRuntime = Effect.fn("contentAcceptance.readLocalRuntime")(
  function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(`${root}/.cache/acceptance`))) {
      return;
    }
    return yield* readReservedLocalRuntime(root);
  }
);

/**
 * Holds the lease of the reserved runtime and reads its manifest. The lease comes
 * first, so a runtime that a live run still prepares is refused as in use instead
 * of being reported as a broken manifest. Returns nothing when no runtime is
 * reserved. The lease lasts for the caller's scope.
 */
export const leaseReservedLocalRuntime = Effect.fn(
  "contentAcceptance.leaseReservedLocalRuntime"
)(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(`${root}/.cache/acceptance`))) {
    return Option.none<LocalRuntime>();
  }
  yield* leaseLocalRuntime(root);
  return Option.some(yield* readReservedLocalRuntime(root));
});

/** Deletes a stopped runtime only after its recorded filesystem ownership still matches. */
export const cleanLocalRuntime = Effect.fn(
  "contentAcceptance.cleanLocalRuntime"
)(function* (root: string) {
  const reserved = yield* leaseReservedLocalRuntime(root);
  if (Option.isNone(reserved)) {
    return;
  }
  const runtime = reserved.value;
  yield* assertLocalPortsFree(runtime);
  yield* releaseLocalRuntime(runtime);
});

/** The clean mode of the acceptance command line: removes a stopped local runtime. It takes no argument. */
export const cleanMode = {
  mode: "clean",
  usage: "clean",
  run: cleanLocalRuntime,
} satisfies AcceptanceMode;
