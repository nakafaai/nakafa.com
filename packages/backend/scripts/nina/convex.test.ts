import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import {
  ConvexCli,
  requireDevelopment,
  runConvex,
} from "@repo/backend/scripts/nina/convex";
import {
  Array as Arr,
  ConfigProvider,
  Duration,
  Effect,
  FileSystem,
  Option,
  Schema,
} from "effect";

/**
 * A double for the Convex CLI. Its first argument says what it does: print its
 * folder, arguments and three settings of its environment, fail with an error
 * text, never answer, or fail without an error text. A setting that is not set
 * prints as null, and a blank one as an empty text.
 */
const FAKE_CLI = `
const [mode, ...rest] = process.argv.slice(2);
const setting = (name) =>
  Object.hasOwn(process.env, name) ? process.env[name] : null;
if (mode === "echo") {
  process.stdout.write(
    JSON.stringify({
      args: rest,
      cwd: process.cwd(),
      env: {
        absent: setting("NINA_GATE_ABSENT"),
        blank: setting("NINA_GATE_BLANK"),
        named: setting("NINA_GATE_NAMED"),
      },
    })
  );
} else if (mode === "fail") {
  process.stderr.write("\\u001b[31mboom " + rest.join(" ") + "\\u001b[0m");
  process.exit(3);
} else if (mode === "hang") {
  setInterval(() => {}, 1000);
} else {
  process.exit(1);
}
`;

const Echo = Schema.fromJsonString(
  Schema.Struct({
    args: Schema.Array(Schema.String),
    cwd: Schema.String,
    env: Schema.Struct({
      absent: Schema.NullOr(Schema.String),
      blank: Schema.NullOr(Schema.String),
      named: Schema.NullOr(Schema.String),
    }),
  })
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
      env: {},
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
        expect(echoed.args).toEqual(["a", "b"]);
        expect(echoed.cwd).toBe(directory);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live("starts the CLI with the settings it is given, blank ones too", () =>
    Effect.gen(function* () {
      const { cli } = yield* fixture;

      const printed = yield* runConvex("Echo", ["echo"]).pipe(
        Effect.provideService(ConvexCli, {
          ...cli,
          env: { NINA_GATE_BLANK: "", NINA_GATE_NAMED: "dev:happy-animal-123" },
        })
      );

      const echoed = yield* Schema.decodeEffect(Echo)(printed);
      expect(echoed.env).toEqual({
        absent: null,
        blank: "",
        named: "dev:happy-animal-123",
      });
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

  it.effect("starts the CLI file that this package installs", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const cli = yield* ConvexCli;
      const entry = Option.getOrThrow(Arr.head(cli.args));

      expect(yield* fs.exists(`${cli.cwd}/${entry}`)).toBe(true);
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});

describe("the deployment check of the release gate", () => {
  it.effect(
    "goes on with a dev deployment and blanks the key and the token the CLI reads",
    () =>
      Effect.gen(function* () {
        const returned = yield* requireDevelopment().pipe(
          settings({ CONVEX_DEPLOYMENT: "dev:happy-animal-123" })
        );

        expect(returned).toEqual({
          CONVEX_DEPLOYMENT: "dev:happy-animal-123",
          CONVEX_DEPLOYMENT_TOKEN: "",
          CONVEX_DEPLOY_KEY: "",
        });
      })
  );

  it.effect("refuses when nothing names a deployment", () =>
    Effect.gen(function* () {
      const error = yield* requireDevelopment().pipe(settings({}), Effect.flip);

      expect(error.message).toContain("No deployment is configured");
    })
  );

  it.effect.each([
    [
      "a dev deploy key beside a dev deployment",
      {
        CONVEX_DEPLOYMENT: "dev:happy-animal-123",
        CONVEX_DEPLOY_KEY: "dev:happy-animal-123|top-secret",
      },
    ],
    [
      "a project key, which ignores the deployment that is named",
      {
        CONVEX_DEPLOYMENT: "dev:happy-animal-123",
        CONVEX_DEPLOY_KEY: "project:team:name|top-secret",
      },
    ],
    [
      "a key with no type, which the CLI reads as production",
      {
        CONVEX_DEPLOYMENT: "dev:happy-animal-123",
        CONVEX_DEPLOY_KEY: "top-secret",
      },
    ],
    [
      "a deployment token beside a dev deployment",
      {
        CONVEX_DEPLOYMENT: "dev:happy-animal-123",
        CONVEX_DEPLOYMENT_TOKEN: "prod:other-name-1|top-secret",
      },
    ],
    [
      "only a deploy key",
      { CONVEX_DEPLOY_KEY: "dev:happy-animal-123|top-secret" },
    ],
    [
      "only a deployment token",
      { CONVEX_DEPLOYMENT_TOKEN: "dev:happy-animal-123|top-secret" },
    ],
  ] as const)("refuses %s and never repeats the setting", ([, env]) =>
    Effect.gen(function* () {
      const error = yield* requireDevelopment().pipe(
        settings(env),
        Effect.flip
      );

      expect(error.message).toContain(
        "Refusing to run with a deploy key or a deployment token set"
      );
      expect(error.message).not.toContain("top-secret");
    })
  );

  it.effect.each([
    ["a production deployment", "prod:other-name-1"],
    ["a preview deployment", "preview:other-name-1"],
    [
      "the production name without its type",
      CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
    ],
    [
      "the production name behind the dev type",
      `dev:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}`,
    ],
    ["a name with no type", "happy-animal-123"],
  ] as const)("refuses %s and never repeats the setting", ([, deployment]) =>
    Effect.gen(function* () {
      const error = yield* requireDevelopment().pipe(
        settings({ CONVEX_DEPLOYMENT: deployment }),
        Effect.flip
      );

      expect(error.message).toContain(
        "Refusing to run against a deployment that is not a dev deployment"
      );
      expect(error.message).not.toContain(deployment);
    })
  );
});
