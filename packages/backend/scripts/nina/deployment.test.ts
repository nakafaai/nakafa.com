import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type { RunConvex } from "@repo/backend/scripts/content/acceptance/convex";
import {
  makeDeployment,
  type Question,
} from "@repo/backend/scripts/nina/deployment";
import {
  gateError,
  type NinaGateError,
} from "@repo/backend/scripts/nina/error";
import {
  ACCOUNT_SEED,
  PASSWORD_SIGN_IN,
  SIGN_IN_ANSWERS,
} from "@repo/backend/test/acceptance";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, MutableList, Option, Schema } from "effect";
import { SecureRandom } from "effect/crypto";

/** A value as the deployment answers it, written as its JSON text. */
const decodeJson = Schema.decodeUnknownSync(JsonTextSchema);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ACCOUNT_STEP = /^Learner account: /u;
const JOURNAL_STEP = /^Agent journal: /u;
const TURN_STEP = /^Nina turn: /u;
const LEARNER = { sessionId: "session-1" };
const REMOVAL_STEP = /^Learner removal: /u;
/** What the seed and Convex Auth's password sign-in answer, by the step that calls them. */
const SIGN_IN = {
  "Learner account": Effect.succeed(SIGN_IN_ANSWERS[ACCOUNT_SEED]),
  "Learner sign-in": Effect.succeed(SIGN_IN_ANSWERS[PASSWORD_SIGN_IN]),
};
const CHAT = Schema.decodeUnknownSync(Id("chats"))("chat-1");
const QUESTION = {
  kind: "message",
  page: { locale: "en", slug: "subjects/some/lesson" },
  prompt: { text: "Explain this lesson." },
} satisfies Question;
const RECEIPT_TEXT =
  '{"prompt":{"text":"Explain this lesson.","files":[]},"chatId":"chat-1","threadId":"thread-1","turnId":"turn-1","promptMessageId":"message-1","order":0}';
const TURN_TEXT =
  '{"order":0,"promptMessageId":"message-1","promptedAt":1000,"state":{"status":"complete","finishedAt":2000},"usage":[]}';
const JOURNAL_TEXT =
  '{"page":[{"_id":"message-1","agentName":"nina","finishReason":"stop","message":{"role":"assistant","content":"Done."},"order":0,"status":"success","stepOrder":1,"usage":{"cachedInputTokens":4000,"completionTokens":90,"promptTokens":4500}}],"isDone":true,"continueCursor":""}';

const RECEIPT = decodeJson(RECEIPT_TEXT);
const JOURNAL = decodeJson(JOURNAL_TEXT);

/** The arguments of one call to a runner: the step, the call, the secrets. */
type Call = Parameters<RunConvex<NinaGateError, never>>;

/** A runner that answers by step name, with `null` for a step it was not told about, and records each call. */
function scripted(
  answers: Record<string, Effect.Effect<unknown, NinaGateError>>
) {
  const calls = MutableList.make<Call>();
  const run: RunConvex<NinaGateError, never> = (...call) => {
    MutableList.append(calls, call);
    return answers[call[0]] ?? Effect.succeed(null);
  };
  return { calls, run };
}

/** The only call that a scripted runner recorded. */
const onlyCall = (calls: MutableList.MutableList<Call>) =>
  Option.getOrThrow(Arr.head(MutableList.toArray(calls)));

/** Builds the deployment over a scripted runner and the real secure random source. */
const deploymentOver = (run: RunConvex<NinaGateError, never>) =>
  Effect.map(SecureRandom.SecureRandom, (random) =>
    makeDeployment(run, random)
  ).pipe(Effect.provide(SecureRandom.layerWebCrypto));

const Identity = Schema.Struct({ subject: Schema.String });
const StartArguments = Schema.Struct({
  input: Schema.Unknown,
  requestId: Schema.String,
});
const ChatArguments = Schema.Struct({ chatId: Schema.String });
const JournalArguments = Schema.Struct({
  order: Schema.String,
  paginationOpts: Schema.Struct({
    cursor: Schema.Null,
    numItems: Schema.Finite,
  }),
  threadId: Schema.String,
});

describe("the deployment of the release gate over a runner", () => {
  it.effect(
    "signs a learner in with the seed's password and keeps the session it made",
    () =>
      Effect.gen(function* () {
        const { calls, run } = scripted(SIGN_IN);
        const deployment = yield* deploymentOver(run);

        expect(yield* deployment.signIn).toEqual(LEARNER);
        expect(
          Arr.map(MutableList.toArray(calls), ([step, call]) => [step, call.path])
        ).toEqual([
          ["Learner account", "acceptance/accounts:create"],
          ["Learner sign-in", "auth/core:signInWithUsernamePassword"],
        ]);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("keeps the failure of a step as it is", () =>
    Effect.gen(function* () {
      const failure = gateError("Learner sign-in failed: no such function");
      const { run } = scripted({
        ...SIGN_IN,
        "Learner sign-in": Effect.fail(failure),
      });
      const deployment = yield* deploymentOver(run);

      expect(yield* deployment.signIn.pipe(Effect.flip)).toBe(failure);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "names the step of an answer it cannot read, and not the answer",
    () =>
      Effect.gen(function* () {
        const { run } = scripted({
          "Learner account": Effect.succeed("Uncaught ConvexError token-9f2c"),
        });
        const deployment = yield* deploymentOver(run);

        const error = yield* deployment.signIn.pipe(Effect.flip);

        expect(error._tag).toBe("NinaGateError");
        expect(error.message).toMatch(ACCOUNT_STEP);
        expect(error.message).not.toContain("token-9f2c");
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("asks a question as the learner and reads the receipt", () =>
    Effect.gen(function* () {
      const { calls, run } = scripted({ "Nina turn": Effect.succeed(RECEIPT) });
      const deployment = yield* deploymentOver(run);

      const receipt = yield* deployment.ask(LEARNER, QUESTION);

      expect(receipt).toMatchObject({ chatId: "chat-1", turnId: "turn-1" });
      const [step, call] = onlyCall(calls);
      expect(step).toBe("Nina turn");
      expect(call.path).toBe("nina/turns:start");
      expect(
        yield* Schema.decodeUnknownEffect(Identity)(call.identity)
      ).toEqual({ subject: "session-1" });
      const sent = yield* Schema.decodeUnknownEffect(StartArguments)(call.args);
      expect(sent.input).toEqual(QUESTION);
      expect(sent.requestId).toMatch(UUID);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("names the step when the receipt cannot be read", () =>
    Effect.gen(function* () {
      const { run } = scripted({ "Nina turn": Effect.succeed({}) });
      const deployment = yield* deploymentOver(run);

      const error = yield* deployment.ask(LEARNER, QUESTION).pipe(Effect.flip);

      expect(error.message).toMatch(TURN_STEP);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("reads the newest turn of the chat", () =>
    Effect.gen(function* () {
      const { calls, run } = scripted({
        "Stored turn": Effect.succeed(
          decodeJson(`{"chat":{"title":"x"},"turn":${TURN_TEXT}}`)
        ),
      });
      const deployment = yield* deploymentOver(run);

      const turn = yield* deployment.read(LEARNER, CHAT);

      expect(turn.state).toEqual({ finishedAt: 2000, status: "complete" });
      const [step, call] = onlyCall(calls);
      expect(step).toBe("Stored turn");
      expect(call.path).toBe("nina/conversation:get");
      expect(
        yield* Schema.decodeUnknownEffect(ChatArguments)(call.args)
      ).toEqual({
        chatId: "chat-1",
      });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("fails when the chat holds no turn", () =>
    Effect.gen(function* () {
      const { run } = scripted({
        "Stored turn": Effect.succeed({ chat: {}, turn: null }),
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
      const [step, call] = onlyCall(calls);
      expect(step).toBe("Agent journal");
      expect(call).toMatchObject({
        component: "nina",
        path: "messages:listMessagesByThreadId",
      });
      expect(
        yield* Schema.decodeUnknownEffect(JournalArguments)(call.args)
      ).toEqual({
        order: "asc",
        paginationOpts: { cursor: null, numItems: 100 },
        threadId: "thread-1",
      });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect.each([
    ["is no record", "Uncaught ConvexError the answer text"],
    ["has another shape", { page: [{ message: "the answer text" }] }],
  ] as const)(
    "names the step when the journal %s, and never quotes it",
    ([, answered]) =>
      Effect.gen(function* () {
        const { run } = scripted({ "Agent journal": Effect.succeed(answered) });
        const deployment = yield* deploymentOver(run);

        const error = yield* deployment.journal("thread-1").pipe(Effect.flip);

        expect(error.message).toMatch(JOURNAL_STEP);
        expect(error.message).not.toContain("the answer text");
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("removes the chat as its learner", () =>
    Effect.gen(function* () {
      const { calls, run } = scripted({});
      const deployment = yield* deploymentOver(run);

      yield* deployment.forget(LEARNER, CHAT);

      const [step, call] = onlyCall(calls);
      expect(step).toBe("Chat removal");
      expect(call.path).toBe("chats/mutations:deleteChat");
      expect(
        yield* Schema.decodeUnknownEffect(ChatArguments)(call.args)
      ).toEqual({
        chatId: "chat-1",
      });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "deletes the learner's account as the learner, as the settings page does",
    () =>
      Effect.gen(function* () {
        const { calls, run } = scripted({});
        const deployment = yield* deploymentOver(run);

        yield* deployment.retire(LEARNER);

        const [step, call] = onlyCall(calls);
        expect(step).toBe("Learner removal");
        expect(call).toMatchObject({
          args: {},
          identity: { subject: "session-1" },
          path: "auth/deletion:deleteAccount",
        });
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("names the step when the deletion answers anything but null", () =>
    Effect.gen(function* () {
      const { run } = scripted({
        "Learner removal": Effect.succeed("continue"),
      });
      const deployment = yield* deploymentOver(run);

      const error = yield* deployment.retire(LEARNER).pipe(Effect.flip);

      expect(error.message).toMatch(REMOVAL_STEP);
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});
