import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type { RunConvex } from "@repo/backend/scripts/content/acceptance/account";
import { ConvexCli } from "@repo/backend/scripts/nina/convex";
import {
  Deployment,
  DeploymentLive,
  makeDeployment,
  type Question,
} from "@repo/backend/scripts/nina/deployment";
import {
  gateError,
  type NinaGateError,
} from "@repo/backend/scripts/nina/error";
import {
  Array as Arr,
  ConfigProvider,
  Crypto,
  Duration,
  Effect,
  FileSystem,
  MutableList,
  Option,
  Schema,
} from "effect";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ACCOUNT_STEP = /^Learner account: /u;
const JOURNAL_STEP = /^Agent journal: /u;
const TURN_STEP = /^Nina turn: /u;
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

/** The arguments of one call to a runner: the step, the CLI arguments, the secrets. */
type Call = Parameters<RunConvex<NinaGateError, never>>;

/** A runner that answers by step name, with `null` for a step it was not told about, and records each call. */
function scripted(
  answers: Record<string, Effect.Effect<string, NinaGateError>>
) {
  const calls = MutableList.make<Call>();
  const run: RunConvex<NinaGateError, never> = (...call) => {
    MutableList.append(calls, call);
    return answers[call[0]] ?? Effect.succeed("null");
  };
  return { calls, run };
}

/** The only call that a scripted runner recorded. */
const onlyCall = (calls: MutableList.MutableList<Call>) =>
  Option.getOrThrow(Arr.head(MutableList.toArray(calls)));

/** The argument of a call at an index. */
const argumentAt = (args: readonly string[], index: number) =>
  Option.getOrThrow(Arr.get(args, index));

/** Builds the deployment over a scripted runner and the real Crypto service. */
const deploymentOver = (run: RunConvex<NinaGateError, never>) =>
  Effect.map(Crypto.Crypto, (crypto) => makeDeployment(run, crypto));

const Identity = Schema.fromJsonString(
  Schema.Struct({ sessionId: Schema.String, subject: Schema.String })
);
const StartArguments = Schema.fromJsonString(
  Schema.Struct({ input: Schema.Unknown, requestId: Schema.String })
);
const ChatArguments = Schema.fromJsonString(
  Schema.Struct({ chatId: Schema.String })
);
const JournalArguments = Schema.fromJsonString(
  Schema.Struct({
    order: Schema.String,
    paginationOpts: Schema.Struct({
      cursor: Schema.Null,
      numItems: Schema.Finite,
    }),
    threadId: Schema.String,
  })
);
const RemovalArguments = Schema.fromJsonString(
  Schema.Struct({ attemptId: Schema.String, authId: Schema.String })
);

describe("the deployment of the release gate over a runner", () => {
  it.effect(
    "signs a learner in through the account, profile and session rows",
    () =>
      Effect.gen(function* () {
        const { run } = scripted({
          "Learner account": Effect.succeed(
            '{"_creationTime":1,"_id":"user-1"}'
          ),
          "Learner session": Effect.succeed(
            '{"_creationTime":2,"_id":"session-1"}'
          ),
        });
        const deployment = yield* deploymentOver(run);

        expect(yield* deployment.signIn).toEqual(LEARNER);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("keeps the failure of a command as it is", () =>
    Effect.gen(function* () {
      const failure = gateError("Learner profile failed: no such function");
      const { run } = scripted({
        "Learner account": Effect.succeed('{"_creationTime":1,"_id":"user-1"}'),
        "Learner profile": Effect.fail(failure),
      });
      const deployment = yield* deploymentOver(run);

      expect(yield* deployment.signIn.pipe(Effect.flip)).toBe(failure);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("names the step of an answer it cannot read", () =>
    Effect.gen(function* () {
      const { run } = scripted({
        "Learner account": Effect.succeed("Uncaught ConvexError"),
      });
      const deployment = yield* deploymentOver(run);

      const error = yield* deployment.signIn.pipe(Effect.flip);

      expect(error._tag).toBe("NinaGateError");
      expect(error.message).toMatch(ACCOUNT_STEP);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("asks a question as the learner and reads the receipt", () =>
    Effect.gen(function* () {
      const { calls, run } = scripted({ "Nina turn": Effect.succeed(RECEIPT) });
      const deployment = yield* deploymentOver(run);

      const receipt = yield* deployment.ask(LEARNER, QUESTION);

      expect(receipt).toMatchObject({ chatId: "chat-1", turnId: "turn-1" });
      const [step, args] = onlyCall(calls);
      expect(step).toBe("Nina turn");
      expect(Arr.take(args, 2)).toEqual(["run", "--identity"]);
      expect(argumentAt(args, 3)).toBe("nina/turns:start");
      expect(yield* Schema.decodeEffect(Identity)(argumentAt(args, 2))).toEqual(
        { sessionId: "session-1", subject: "user-1" }
      );
      const sent = yield* Schema.decodeEffect(StartArguments)(
        argumentAt(args, 4)
      );
      expect(sent.input).toEqual(QUESTION);
      expect(sent.requestId).toMatch(UUID);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("names the step when the receipt cannot be read", () =>
    Effect.gen(function* () {
      const { run } = scripted({ "Nina turn": Effect.succeed("{}") });
      const deployment = yield* deploymentOver(run);

      const error = yield* deployment.ask(LEARNER, QUESTION).pipe(Effect.flip);

      expect(error.message).toMatch(TURN_STEP);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("reads the newest turn of the chat", () =>
    Effect.gen(function* () {
      const { calls, run } = scripted({
        "Stored turn": Effect.succeed(`{"chat":{"title":"x"},"turn":${TURN}}`),
      });
      const deployment = yield* deploymentOver(run);

      const turn = yield* deployment.read(LEARNER, CHAT);

      expect(turn.state).toEqual({ finishedAt: 2000, status: "complete" });
      const [step, args] = onlyCall(calls);
      expect(step).toBe("Stored turn");
      expect(argumentAt(args, 3)).toBe("nina/conversation:get");
      expect(
        yield* Schema.decodeEffect(ChatArguments)(argumentAt(args, 4))
      ).toEqual({ chatId: "chat-1" });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("fails when the chat holds no turn", () =>
    Effect.gen(function* () {
      const { run } = scripted({
        "Stored turn": Effect.succeed('{"chat":{},"turn":null}'),
      });
      const deployment = yield* deploymentOver(run);

      const error = yield* deployment.read(LEARNER, CHAT).pipe(Effect.flip);

      expect(error.message).toBe("The chat holds no turn.");
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("lists the journal of the thread through the Agent component", () =>
    Effect.gen(function* () {
      const { calls, run } = scripted({
        "Agent journal": Effect.succeed(JOURNAL),
      });
      const deployment = yield* deploymentOver(run);

      const journal = yield* deployment.journal("thread-1");

      expect(journal).toEqual([
        {
          agentName: "nina",
          finishReason: "stop",
          message: { role: "assistant" },
          status: "success",
          usage: {
            cachedInputTokens: 4000,
            completionTokens: 90,
            promptTokens: 4500,
          },
        },
      ]);
      const [step, args] = onlyCall(calls);
      expect(step).toBe("Agent journal");
      expect(Arr.take(args, 4)).toEqual([
        "run",
        "--component",
        "nina",
        "messages:listMessagesByThreadId",
      ]);
      expect(
        yield* Schema.decodeEffect(JournalArguments)(argumentAt(args, 4))
      ).toEqual({
        order: "asc",
        paginationOpts: { cursor: null, numItems: 100 },
        threadId: "thread-1",
      });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("names the step when the journal cannot be read", () =>
    Effect.gen(function* () {
      const { run } = scripted({
        "Agent journal": Effect.succeed("Uncaught ConvexError"),
      });
      const deployment = yield* deploymentOver(run);

      const error = yield* deployment.journal("thread-1").pipe(Effect.flip);

      expect(error.message).toMatch(JOURNAL_STEP);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("removes the chat as its learner", () =>
    Effect.gen(function* () {
      const { calls, run } = scripted({});
      const deployment = yield* deploymentOver(run);

      yield* deployment.forget(LEARNER, CHAT);

      const [step, args] = onlyCall(calls);
      expect(step).toBe("Chat removal");
      expect(argumentAt(args, 3)).toBe("chats/mutations:deleteChat");
      expect(
        yield* Schema.decodeEffect(ChatArguments)(argumentAt(args, 4))
      ).toEqual({ chatId: "chat-1" });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "starts the removal of the learner through the app's own deletion",
    () =>
      Effect.gen(function* () {
        const { calls, run } = scripted({
          "Learner removal": Effect.succeed('"ready"'),
        });
        const deployment = yield* deploymentOver(run);

        yield* deployment.retire(LEARNER);

        const [step, args] = onlyCall(calls);
        expect(step).toBe("Learner removal");
        expect(Arr.take(args, 2)).toEqual([
          "run",
          "auth/deletion:claimAccountDeletion",
        ]);
        const removal = yield* Schema.decodeEffect(RemovalArguments)(
          argumentAt(args, 2)
        );
        expect(removal.authId).toBe("user-1");
        expect(removal.attemptId).toMatch(UUID);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("fails when the deletion does not answer ready", () =>
    Effect.gen(function* () {
      const { run } = scripted({
        "Learner removal": Effect.succeed('"continue"'),
      });
      const deployment = yield* deploymentOver(run);

      const error = yield* deployment.retire(LEARNER).pipe(Effect.flip);

      expect(error.message).toBe(
        "Learner removal answered continue instead of ready."
      );
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});

/**
 * A double for the Convex CLI that logs each call and answers the functions of
 * the gate the way the deployment does.
 */
const FAKE_CLI = `
import { appendFileSync } from "node:fs";
const [log, ...args] = process.argv.slice(2);
const fn = args.find((arg) => /^[A-Za-z][\\w/-]*:[A-Za-z]\\w*$/.test(arg));
appendFileSync(log, JSON.stringify({ args, fn }) + "\\n");
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
  Schema.Struct({ fn: Schema.optionalKey(Schema.String) })
);

/** A folder with the CLI double, the log it writes, and the way to start it. */
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.realPath(
    yield* fs.makeTempDirectoryScoped({ prefix: "nina-gate-deployment-test-" })
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
    },
    log,
  };
});

/** The functions that the CLI double was asked to run, in order. */
const loggedFunctions = (log: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const lines = Arr.filter(
      (yield* fs.readFileString(log)).split("\n"),
      (line) => line !== ""
    );
    const entries = yield* Effect.forEach(lines, (line) =>
      Schema.decodeEffect(Logged)(line)
    );
    return Arr.map(entries, ({ fn }) => fn);
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

      expect(yield* loggedFunctions(log)).toEqual([
        "adapter:create",
        "auth/lifecycle:onCreate",
        "adapter:create",
        "nina/turns:start",
        "nina/conversation:get",
        "messages:listMessagesByThreadId",
        "chats/mutations:deleteChat",
        "auth/deletion:claimAccountDeletion",
      ]);
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
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

      expect(error.message).toContain("Refusing to run against the production");
      expect(yield* fs.exists(log)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
