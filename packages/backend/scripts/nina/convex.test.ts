import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import {
  ConvexCli,
  requireDevelopment,
  runConvex,
} from "@repo/backend/scripts/nina/convex";
import { ConfigProvider, Duration, Effect, FileSystem, Schema } from "effect";

/**
 * A double for the Convex CLI. Its first argument says what it does: print its
 * folder and arguments, fail with an error text, never answer, or fail without
 * an error text.
 */
const FAKE_CLI = `
const [mode, ...rest] = process.argv.slice(2);
if (mode === "echo") {
  process.stdout.write(JSON.stringify({ args: rest, cwd: process.cwd() }));
} else if (mode === "fail") {
  process.stderr.write("\\u001b[31mboom " + rest.join(" ") + "\\u001b[0m");
  process.exit(3);
} else if (mode === "hang") {
  setInterval(() => {}, 1000);
} else {
  process.exit(1);
}
`;

/** The folder of this package, reached from the folder of the script. */
const BACKEND_FOLDER = /\/packages\/backend\/scripts\/nina\/\.\.\/\.\.$/u;

const Echo = Schema.fromJsonString(
  Schema.Struct({ args: Schema.Array(Schema.String), cwd: Schema.String })
);

/** A folder with the CLI double in it, and the way to start that double. */
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.realPath(
    yield* fs.makeTempDirectoryScoped({ prefix: "nina-gate-cli-test-" })
  );
  const script = `${directory}/cli.mjs`;
  yield* fs.writeFileString(script, FAKE_CLI);
  return {
    cli: {
      args: [script],
      command: process.execPath,
      cwd: directory,
      deadline: Duration.seconds(30),
    },
    directory,
  };
});

/** A configuration that holds exactly these environment settings. */
const settings = (env: Record<string, string>) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnv({ env })
  );

describe("the Convex CLI of the release gate", () => {
  it.live(
    "runs in the folder it is given and returns what the CLI printed",
    () =>
      Effect.gen(function* () {
        const { cli, directory } = yield* fixture;

        const printed = yield* runConvex("Echo", ["echo", "a", "b"]).pipe(
          Effect.provideService(ConvexCli, cli)
        );

        const echoed = yield* Schema.decodeEffect(Echo)(printed);
        expect(echoed).toEqual({ args: ["a", "b"], cwd: directory });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live(
    "reports the error output of a failed command without its secrets",
    () =>
      Effect.gen(function* () {
        const { cli } = yield* fixture;

        const error = yield* runConvex(
          "Secret step",
          ["fail", "token-123", "and", "more"],
          ["token-123"]
        ).pipe(Effect.provideService(ConvexCli, cli), Effect.flip);

        expect(error).toMatchObject({
          _tag: "NinaGateError",
          message: "Secret step failed: boom [redacted] and more",
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live("says only that a command failed when it printed no error", () =>
    Effect.gen(function* () {
      const { cli } = yield* fixture;

      const error = yield* runConvex("Silent step", ["silent"]).pipe(
        Effect.provideService(ConvexCli, cli),
        Effect.flip
      );

      expect(error).toMatchObject({
        _tag: "NinaGateError",
        message: "Silent step failed.",
      });
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live("reports a CLI that cannot start", () =>
    Effect.gen(function* () {
      const { cli, directory } = yield* fixture;

      const error = yield* runConvex("Missing step", []).pipe(
        Effect.provideService(ConvexCli, {
          ...cli,
          args: [],
          command: `${directory}/missing-cli`,
        }),
        Effect.flip
      );

      expect(error._tag).toBe("NinaGateError");
      expect(error.message).toContain(
        "Missing step could not run the Convex CLI"
      );
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live("stops a CLI that does not answer in time", () =>
    Effect.gen(function* () {
      const { cli } = yield* fixture;

      const error = yield* runConvex("Slow step", ["hang"]).pipe(
        Effect.provideService(ConvexCli, {
          ...cli,
          deadline: Duration.millis(200),
        }),
        Effect.flip
      );

      expect(error).toMatchObject({
        _tag: "NinaGateError",
        message: `Slow step did not answer within ${Duration.format(Duration.millis(200))}.`,
      });
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("starts the real CLI from the folder of this package", () =>
    Effect.gen(function* () {
      const cli = yield* ConvexCli;

      expect(cli.args).toEqual(["node_modules/convex/bin/main.js"]);
      expect(cli.command).toBe(process.execPath);
      expect(cli.cwd).toMatch(BACKEND_FOLDER);
      expect(Duration.toMillis(cli.deadline)).toBeGreaterThan(0);
    })
  );
});

describe("the deployment check of the release gate", () => {
  it.effect.each([
    ["a dev deployment", { CONVEX_DEPLOYMENT: "dev:happy-animal-123" }],
    [
      "a dev deployment and a dev deploy key",
      {
        CONVEX_DEPLOYMENT: "dev:happy-animal-123",
        CONVEX_DEPLOY_KEY: "dev:happy-animal-123|secret",
      },
    ],
    [
      "only a dev deploy key",
      { CONVEX_DEPLOY_KEY: "dev:happy-animal-123|key" },
    ],
  ] as const)("goes on with %s", ([, env]) =>
    requireDevelopment().pipe(settings(env), Effect.asVoid)
  );

  it.effect("refuses when nothing names a deployment", () =>
    Effect.gen(function* () {
      const error = yield* requireDevelopment().pipe(settings({}), Effect.flip);

      expect(error.message).toContain("No deployment is configured");
    })
  );

  it.effect.each([
    ["a production deployment", { CONVEX_DEPLOYMENT: "prod:other-name-1" }],
    [
      "a production deploy key",
      { CONVEX_DEPLOY_KEY: "prod:other-name-1|top-secret" },
    ],
    [
      "the production name without its type",
      { CONVEX_DEPLOYMENT: CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT },
    ],
    [
      "production behind a dev deployment",
      {
        CONVEX_DEPLOYMENT: "dev:happy-animal-123",
        CONVEX_DEPLOY_KEY: `dev:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}|top-secret`,
      },
    ],
  ] as const)("refuses %s and never repeats the setting", ([, env]) =>
    Effect.gen(function* () {
      const error = yield* requireDevelopment().pipe(
        settings(env),
        Effect.flip
      );

      expect(error.message).toContain(
        "Refusing to run against the production deployment"
      );
      expect(error.message).not.toContain("top-secret");
      expect(error.message).not.toContain(
        CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT
      );
    })
  );
});
