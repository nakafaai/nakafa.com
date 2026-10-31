import {
  acceptanceRuntimeError,
  sanitizeAcceptanceCommandError,
} from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";

/** What `convex init` saved about the deployment it created for this runtime. */
export const LocalDeploymentJson = Schema.fromJsonString(
  Schema.Struct({
    adminKey: Schema.String,
    backendVersion: Schema.String,
    deploymentName: Schema.String,
    instanceSecret: Schema.String,
    ports: Schema.Struct({ cloud: Schema.Finite, site: Schema.Finite }),
  })
);

/** Pushes every function to the running backend and appends what the CLI prints to its log. */
export const deployFunctions = Effect.fn("contentAcceptance.deployFunctions")(
  function* (
    runtime: LocalRuntime,
    deployment: typeof LocalDeploymentJson.Type,
    environment: Record<string, string | undefined>,
    logPath: string
  ) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const environmentFile = `${runtime.backend}/deploy.env`;
    yield* fileSystem.writeFileString(
      environmentFile,
      `CONVEX_SELF_HOSTED_URL=${runtime.query}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${deployment.adminKey}\n`,
      { mode: 0o600 }
    );
    const push = yield* ChildProcess.make(
      process.execPath,
      [
        "node_modules/convex/bin/main.js",
        "deploy",
        "--typecheck",
        "disable",
        "--skip-large-indexes-check",
        "--env-file",
        environmentFile,
      ],
      {
        cwd: path.resolve(runtime.directory, "../../packages/backend"),
        env: environment,
        extendEnv: true,
        stdin: "ignore",
      }
    );
    yield* push.all.pipe(Stream.run(fileSystem.sink(logPath, { flag: "a" })));
    const code = yield* push.exitCode;
    if (code !== 0) {
      const detail = sanitizeAcceptanceCommandError(
        yield* fileSystem.readFileString(logPath),
        [runtime.publicationToken, deployment.adminKey]
      );
      return yield* acceptanceRuntimeError(
        `The local Convex deploy exited with code ${code}: ${detail}`
      );
    }
  },
  Effect.scoped
);
