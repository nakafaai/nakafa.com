import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { ConvexCli } from "@repo/backend/scripts/development/cli";
import {
  Deployment,
  type Question,
} from "@repo/backend/scripts/nina/deployment";
import { DeploymentLive } from "@repo/backend/scripts/nina/live";
import { nodePlatform } from "@repo/backend/test/platform";
import {
  Array as Arr,
  ConfigProvider,
  Duration,
  Effect,
  FileSystem,
  Schema,
} from "effect";

const LEARNER = { authId: "user-1", sessionId: "session-1" };
const CHAT = Schema.decodeUnknownSync(Id("chats"))("chat-1");
const QUESTION = {
  kind: "message",
  page: { locale: "en", slug: "subjects/some/lesson" },
  prompt: { text: "Explain this lesson." },
} satisfies Question;
const RECEIPT =
  '{"prompt":{"text":"Explain this lesson.","files":[]},"chatId":"chat-1","threadId":"thread-1","turnId":"turn-1","promptMessageId":"message-1","order":0}';
const TURN =
  '{"order":0,"promptMessageId":"message-1","promptedAt":1000,"state":{"status":"complete","finishedAt":2000},"usage":[]}';
const JOURNAL =
  '{"page":[{"_id":"message-1","agentName":"nina","finishReason":"stop","message":{"role":"assistant","content":"Done."},"order":0,"status":"success","stepOrder":1,"usage":{"cachedInputTokens":4000,"completionTokens":90,"promptTokens":4500}}],"isDone":true,"continueCursor":""}';

/**
 * A double for the Convex CLI that logs each call, with the settings that pick
 * its deployment, and answers the functions of the gate the way the deployment
 * does. Like the real CLI, it loads the \`.env\` file of its folder first, and
 * that fills in only the settings that are not set. It fails the function that
 * LIVE_TEST_FAILS names, after it logs the call.
 */
const FAKE_CLI = `
import { appendFileSync, existsSync } from "node:fs";
const [log, ...args] = process.argv.slice(2);
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
const setting = (name) =>
  Object.hasOwn(process.env, name) ? process.env[name] : null;
const env = {
  CONVEX_DEPLOYMENT: setting("CONVEX_DEPLOYMENT"),
  CONVEX_DEPLOYMENT_TOKEN: setting("CONVEX_DEPLOYMENT_TOKEN"),
  CONVEX_DEPLOY_KEY: setting("CONVEX_DEPLOY_KEY"),
};
const fn = args.find((arg) => /^[A-Za-z][\\w/-]*:[A-Za-z]\\w*$/.test(arg));
appendFileSync(log, JSON.stringify({ args, env, fn }) + "\\n");
if (fn !== undefined && process.env.LIVE_TEST_FAILS === fn) {
  process.stderr.write("boom");
  process.exit(1);
}
const last = args[args.length - 1];
const answers = {
  "adapter:create": () =>
    JSON.parse(last).input.model === "user"
      ? { _creationTime: 1, _id: "user-1" }
      : { _creationTime: 2, _id: "session-1" },
  "nina/turns:start": () => (${RECEIPT}),
  "nina/conversation:get": () => ({ chat: {}, turn: ${TURN} }),
  "messages:listMessagesByThreadId": () => (${JOURNAL}),
  "auth/deletion:claimAccountDeletion": () => "ready",
};
const answer = fn === undefined ? undefined : answers[fn]?.();
if (answer !== undefined) {
  process.stdout.write(JSON.stringify(answer));
}
`;

const Logged = Schema.fromJsonString(
  Schema.Struct({
    env: Schema.Struct({
      CONVEX_DEPLOYMENT: Schema.NullOr(Schema.String),
      CONVEX_DEPLOYMENT_TOKEN: Schema.NullOr(Schema.String),
      CONVEX_DEPLOY_KEY: Schema.NullOr(Schema.String),
    }),
    fn: Schema.optionalKey(Schema.String),
  })
);

/** A folder with the CLI double, the log it writes, and the way to start it. */
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.realPath(
    yield* fs.makeTempDirectoryScoped({ prefix: "nina-gate-live-test-" })
  );
  const script = `${directory}/cli.mjs`;
  const log = `${directory}/calls.log`;
  yield* fs.writeFileString(script, FAKE_CLI);
  return {
    cli: {
      args: [script, log],
      command: process.execPath,
      cwd: directory,
      deadline: Duration.seconds(30),
      env: {},
    },
    directory,
    log,
  };
});

/** The calls that the CLI double was asked to run, in order. */
const loggedCalls = (log: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const lines = Arr.filter(
      (yield* fs.readFileString(log)).split("\n"),
      (line) => line !== ""
    );
    return yield* Effect.forEach(lines, (line) =>
      Schema.decodeEffect(Logged)(line)
    );
  });

/** A configuration that holds exactly these environment settings. */
const settings = (env: Record<string, string>) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnv({ env })
  );

describe("the deployment of the release gate over the Convex CLI", () => {
  it.live("runs every step of the gate as a Convex function", () =>
    Effect.gen(function* () {
      const { cli, log } = yield* fixture;

      yield* Effect.gen(function* () {
        const deployment = yield* Deployment;
        const learner = yield* deployment.signIn;
        const receipt = yield* deployment.ask(learner, QUESTION);
        const turn = yield* deployment.read(learner, receipt.chatId);
        const journal = yield* deployment.journal(receipt.threadId);
        yield* deployment.forget(learner, receipt.chatId);
        yield* deployment.retire(learner);
        expect(turn.state.status).toBe("complete");
        expect(journal).toHaveLength(1);
      }).pipe(
        Effect.provide(DeploymentLive),
        settings({ CONVEX_DEPLOYMENT: "dev:happy-animal-123" }),
        Effect.provideService(ConvexCli, cli)
      );

      const calls = yield* loggedCalls(log);
      expect(Arr.map(calls, ({ fn }) => fn)).toEqual([
        "adapter:create",
        "adapter:create",
        "auth/lifecycle:onCreate",
        "nina/turns:start",
        "nina/conversation:get",
        "messages:listMessagesByThreadId",
        "chats/mutations:deleteChat",
        "auth/deletion:claimAccountDeletion",
      ]);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.live(
    "starts every command with the deployment it checked, whatever a .env file names",
    () =>
      Effect.gen(function* () {
        const { cli, directory, log } = yield* fixture;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString(
          `${directory}/.env`,
          "CONVEX_DEPLOY_KEY=prod:other-name-1|top-secret\nCONVEX_DEPLOYMENT_TOKEN=prod:other-name-1|top-secret\n"
        );

        yield* Effect.gen(function* () {
          const deployment = yield* Deployment;
          yield* deployment.forget(LEARNER, CHAT);
          yield* deployment.retire(LEARNER);
        }).pipe(
          Effect.provide(DeploymentLive),
          settings({ CONVEX_DEPLOYMENT: "dev:happy-animal-123" }),
          Effect.provideService(ConvexCli, cli)
        );

        const calls = yield* loggedCalls(log);
        expect(Arr.map(calls, ({ env }) => env)).toEqual([
          {
            CONVEX_DEPLOYMENT: "dev:happy-animal-123",
            CONVEX_DEPLOYMENT_TOKEN: "",
            CONVEX_DEPLOY_KEY: "",
          },
          {
            CONVEX_DEPLOYMENT: "dev:happy-animal-123",
            CONVEX_DEPLOYMENT_TOKEN: "",
            CONVEX_DEPLOY_KEY: "",
          },
        ]);
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.live("refuses production before it runs a single command", () =>
    Effect.gen(function* () {
      const { cli, log } = yield* fixture;
      const fs = yield* FileSystem.FileSystem;

      const error = yield* Effect.service(Deployment).pipe(
        Effect.provide(DeploymentLive),
        settings({ CONVEX_DEPLOYMENT: "prod:some-name-1" }),
        Effect.provideService(ConvexCli, cli),
        Effect.flip
      );

      expect(error.message).toContain(
        "Refusing to run against a deployment that is not a dev deployment"
      );
      expect(yield* fs.exists(log)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.live(
    "reports a command that fails as a failure of the gate, with the message of the command",
    () =>
      Effect.gen(function* () {
        const { cli } = yield* fixture;

        const error = yield* Effect.gen(function* () {
          const deployment = yield* Deployment;
          return yield* deployment.signIn;
        }).pipe(
          Effect.provide(DeploymentLive),
          settings({ CONVEX_DEPLOYMENT: "dev:happy-animal-123" }),
          Effect.provideService(ConvexCli, {
            ...cli,
            env: { LIVE_TEST_FAILS: "adapter:create" },
          }),
          Effect.flip
        );

        expect(error).toMatchObject({
          _tag: "NinaGateError",
          message: "Learner account failed: boom",
        });
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );
});
