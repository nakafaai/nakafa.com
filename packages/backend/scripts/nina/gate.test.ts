import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { languageModel, providerId } from "@repo/backend/confect/gateway/model";
import {
  getNakafaReferencesFromMessages,
  getSourceReferencesFromMessages,
} from "@repo/backend/confect/nina/research/source";
import {
  Deployment,
  type Question,
} from "@repo/backend/scripts/nina/deployment";
import {
  gateError,
  type NinaGateError,
} from "@repo/backend/scripts/nina/error";
import { Pace, renderReport, runGate } from "@repo/backend/scripts/nina/gate";
import type {
  GateTurn,
  StoredMessage,
} from "@repo/backend/scripts/nina/verdict";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  Array as Arr,
  Duration,
  Effect,
  Layer,
  Logger,
  MutableList,
  MutableRef,
  Option,
  Schema,
} from "effect";

const LEARNER = { authId: "user-1", sessionId: "session-1" };
const CHAT = Schema.decodeUnknownSync(Id("chats"))("chat-1");
const TURN = Schema.decodeUnknownSync(Id("ninaTurns"))("turn-1");
const RECEIPT = {
  chatId: CHAT,
  order: 0,
  prompt: { files: [], text: "question" },
  promptMessageId: "message-1",
  threadId: "thread-1",
  turnId: TURN,
};

/** The usage of the chat agent in a turn that passes: its second step read the cache through the gateway. */
const chatRow = {
  agent: "nina",
  cached: 5000,
  calls: 2,
  cost: 0.01,
  input: 9000,
  model: languageModel.id,
  output: 300,
  provider: providerId,
} satisfies GateTurn["usage"][number];

/** The usage of the call that names the chat, which runs after the suggestions are saved. */
const titleRow = {
  agent: "title",
  calls: 1,
  input: 800,
  model: languageModel.id,
  output: 8,
  provider: providerId,
} satisfies GateTurn["usage"][number];

/** The first turn of a chat, complete 20 seconds after its admission. */
const complete = {
  order: 0,
  promptedAt: 1000,
  state: { finishedAt: 21_000, status: "complete" },
} as const;
const running = Effect.succeed({
  order: 0,
  promptedAt: 1000,
  state: { status: "running" },
  usage: [],
} satisfies GateTurn);
const answered = Effect.succeed({
  ...complete,
  usage: [chatRow],
} satisfies GateTurn);
const suggested = Effect.succeed({
  ...complete,
  suggestions: ["Next?"],
  usage: [chatRow],
} satisfies GateTurn);
const followedUp = Effect.succeed({
  ...complete,
  suggestions: ["Next?"],
  usage: [chatRow, titleRow],
} satisfies GateTurn);
const failed = Effect.succeed({
  order: 0,
  promptedAt: 1000,
  state: { finishedAt: 21_000, reason: "response-limit", status: "failed" },
  usage: [chatRow],
} satisfies GateTurn);

/** The journal of a turn that passes: the second chat step read what the first one cached. */
const twoSteps = [
  {
    agentName: "nina",
    finishReason: "tool-calls",
    message: { role: "assistant" },
    status: "success",
    usage: { cachedInputTokens: 0, completionTokens: 100, promptTokens: 9000 },
  },
  {
    agentName: "nina",
    finishReason: "stop",
    message: { role: "assistant" },
    status: "success",
    usage: {
      cachedInputTokens: 5000,
      completionTokens: 200,
      promptTokens: 9500,
    },
  },
] satisfies readonly StoredMessage[];

/** A small pace, so that a real wait takes a few milliseconds. */
const quickly = (settle = 500, followUp = 500) =>
  Effect.provideService(Pace, {
    every: Duration.millis(1),
    followUp: Duration.millis(followUp),
    settle: Duration.millis(settle),
  });

/** What a scripted deployment answers: the turns it reads in order, and what each other step does. */
interface Script {
  readonly ask?: Effect.Effect<typeof RECEIPT, NinaGateError>;
  readonly forget?: Effect.Effect<void, NinaGateError>;
  readonly journal?: Effect.Effect<readonly StoredMessage[], NinaGateError>;
  readonly reads: readonly Effect.Effect<GateTurn, NinaGateError>[];
  readonly retire?: Effect.Effect<void, NinaGateError>;
  readonly signIn?: Effect.Effect<typeof LEARNER, NinaGateError>;
}

/**
 * A deployment that follows a script: each read gives the next turn of the
 * script and then repeats the last. It records what the gate did.
 */
function scripted(script: Script) {
  const calls = MutableList.make<string>();
  const questions = MutableList.make<Question>();
  const reads = MutableRef.make(0);
  const record = (call: string) =>
    Effect.sync(() => MutableList.append(calls, call));
  const layer = Layer.succeed(
    Deployment,
    Deployment.of({
      ask: (_, question) =>
        record("ask").pipe(
          Effect.tap(() =>
            Effect.sync(() => MutableList.append(questions, question))
          ),
          Effect.andThen(script.ask ?? Effect.succeed(RECEIPT))
        ),
      forget: (_, chatId) =>
        record(`forget ${chatId}`).pipe(
          Effect.andThen(script.forget ?? Effect.void)
        ),
      journal: (threadId) =>
        record(`journal ${threadId}`).pipe(
          Effect.andThen(script.journal ?? Effect.succeed(twoSteps))
        ),
      read: () =>
        record("read").pipe(
          Effect.andThen(
            Effect.suspend(() => {
              const index = MutableRef.getAndIncrement(reads);
              return Option.getOrThrow(
                Arr.get(script.reads, Math.min(index, script.reads.length - 1))
              );
            })
          )
        ),
      retire: (learner) =>
        record(`retire ${learner.authId}`).pipe(
          Effect.andThen(script.retire ?? Effect.void)
        ),
      signIn: record("signIn").pipe(
        Effect.andThen(script.signIn ?? Effect.succeed(LEARNER))
      ),
    })
  );
  return { calls, layer, questions };
}

describe("the release gate", () => {
  it.live(
    "passes a turn that completes, and removes the chat before the learner",
    () =>
      Effect.gen(function* () {
        const { calls, layer } = scripted({
          reads: [running, answered, followedUp],
        });

        const report = yield* runGate().pipe(Effect.provide(layer), quickly());

        expect(report.failures).toEqual([]);
        expect(report.table).toContain("total");
        expect(report.table).toContain(
          "Cached of input tokens, by nina step: 0 of 9000, 5000 of 9500."
        );
        expect(MutableList.toArray(calls)).toEqual([
          "signIn",
          "ask",
          "read",
          "read",
          "read",
          "journal thread-1",
          "forget chat-1",
          "retire user-1",
        ]);
      })
  );

  it.live("fails a chat step that read nothing from the cache", () =>
    Effect.gen(function* () {
      const { layer } = scripted({
        journal: Effect.succeed([
          ...twoSteps,
          {
            agentName: "nina",
            finishReason: "stop",
            message: { role: "assistant" },
            status: "success",
            usage: {
              cachedInputTokens: 0,
              completionTokens: 50,
              promptTokens: 9800,
            },
          },
        ]),
        reads: [followedUp],
      });

      const report = yield* runGate().pipe(Effect.provide(layer), quickly());

      expect(report.failures).toEqual([
        "Step 3 of the nina agent read no input tokens from the cache (9800 input tokens). A short prompt is not cached, so check that the lesson page the question names still exists.",
      ]);
    })
  );

  it.live(
    "fails when the journal cannot be read, and still removes what it made",
    () =>
      Effect.gen(function* () {
        const failure = gateError("Agent journal failed: offline");
        const { calls, layer } = scripted({
          journal: Effect.fail(failure),
          reads: [followedUp],
        });

        const error = yield* runGate().pipe(
          Effect.provide(layer),
          quickly(),
          Effect.flip
        );

        expect(error).toBe(failure);
        expect(Arr.takeRight(MutableList.toArray(calls), 3)).toEqual([
          "journal thread-1",
          "forget chat-1",
          "retire user-1",
        ]);
      })
  );

  it.live("judges the turn it has when the suggestions do not come", () =>
    Effect.gen(function* () {
      const { calls, layer } = scripted({ reads: [answered] });

      const report = yield* runGate().pipe(
        Effect.provide(layer),
        quickly(500, 20)
      );

      expect(report.failures).toEqual([]);
      const reads = Arr.filter(
        MutableList.toArray(calls),
        (call) => call === "read"
      );
      expect(reads.length).toBeGreaterThan(2);
    })
  );

  it.live(
    "waits for the title call of the first turn, which runs after the suggestions are saved",
    () =>
      Effect.gen(function* () {
        const { calls, layer } = scripted({
          reads: [running, answered, suggested, followedUp],
        });

        const report = yield* runGate().pipe(Effect.provide(layer), quickly());

        expect(report.failures).toEqual([]);
        expect(report.table).toContain("title");
        expect(
          Arr.filter(MutableList.toArray(calls), (call) => call === "read")
        ).toHaveLength(4);
      })
  );

  it.live("judges the turn it has when the title call does not come", () =>
    Effect.gen(function* () {
      const { layer } = scripted({ reads: [suggested] });

      const report = yield* runGate().pipe(
        Effect.provide(layer),
        quickly(500, 20)
      );

      expect(report.failures).toEqual([]);
      expect(report.table).not.toContain("title");
    })
  );

  it.live("judges a turn that failed and still removes what it made", () =>
    Effect.gen(function* () {
      const { calls, layer } = scripted({ reads: [failed] });

      const report = yield* runGate().pipe(Effect.provide(layer), quickly());

      expect(report.failures).toEqual([
        "The turn is failed with the reason response-limit, not complete.",
      ]);
      expect(MutableList.toArray(calls)).toEqual([
        "signIn",
        "ask",
        "read",
        "journal thread-1",
        "forget chat-1",
        "retire user-1",
      ]);
    })
  );

  it.live(
    "fails when the turn never settles, and still removes what it made",
    () =>
      Effect.gen(function* () {
        const { calls, layer } = scripted({ reads: [running] });

        const error = yield* runGate().pipe(
          Effect.provide(layer),
          quickly(30),
          Effect.flip
        );

        expect(error.message).toBe(
          `The turn was still open after ${Duration.format(Duration.millis(30))}.`
        );
        expect(Arr.takeRight(MutableList.toArray(calls), 2)).toEqual([
          "forget chat-1",
          "retire user-1",
        ]);
      })
  );

  it.live(
    "logs what a failed removal leaves behind and keeps the verdict",
    () =>
      Effect.gen(function* () {
        const logged = MutableRef.make<readonly unknown[]>([]);
        const { layer } = scripted({
          forget: Effect.fail(gateError("Chat removal failed: offline")),
          reads: [followedUp],
          retire: Effect.fail(gateError("Learner removal failed: offline")),
        });

        const report = yield* runGate().pipe(
          Effect.provide(layer),
          quickly(),
          Effect.provide(
            Logger.layer([
              Logger.formatStructured.pipe(
                Logger.map(({ message }) =>
                  MutableRef.update(logged, Arr.append(message))
                )
              ),
            ])
          )
        );

        expect(report.failures).toEqual([]);
        expect(MutableRef.get(logged)).toEqual([
          [
            "The gate chat was not removed",
            { chatId: "chat-1", reason: "Chat removal failed: offline" },
          ],
          [
            "The synthetic learner was not removed",
            { authId: "user-1", reason: "Learner removal failed: offline" },
          ],
        ]);
      })
  );

  it.live("asks nothing when the learner cannot sign in", () =>
    Effect.gen(function* () {
      const failure = gateError("Learner account failed: offline");
      const { calls, layer } = scripted({
        reads: [answered],
        signIn: Effect.fail(failure),
      });

      const error = yield* runGate().pipe(
        Effect.provide(layer),
        quickly(),
        Effect.flip
      );

      expect(error).toBe(failure);
      expect(MutableList.toArray(calls)).toEqual(["signIn"]);
    })
  );

  it.live("removes the learner when the question cannot be asked", () =>
    Effect.gen(function* () {
      const failure = gateError("Nina turn failed: not enough credits");
      const { calls, layer } = scripted({
        ask: Effect.fail(failure),
        reads: [answered],
      });

      const error = yield* runGate().pipe(
        Effect.provide(layer),
        quickly(),
        Effect.flip
      );

      expect(error).toBe(failure);
      expect(MutableList.toArray(calls)).toEqual([
        "signIn",
        "ask",
        "retire user-1",
      ]);
    })
  );

  it.live(
    "asks one question that starts Nina's first step with the Nakafa capability",
    () =>
      Effect.gen(function* () {
        const { layer, questions } = scripted({ reads: [followedUp] });

        // The turn is done at the first read, so it waits for nothing and the
        // default pace serves.
        yield* runGate().pipe(Effect.provide(layer));

        const [question] = MutableList.toArray(questions);
        expect(question?.kind).toBe("message");
        const page = question?.page;
        expect(page).toEqual({
          locale: "en",
          slug: "subjects/mathematics/exponential-logarithm/basic-concept",
        });
        const messages = [
          { content: question?.prompt.text ?? "", role: "user" as const },
        ];
        // The link is the page the learner is on, and the only link in the question.
        expect(
          Arr.map(
            getNakafaReferencesFromMessages(messages),
            (reference) => reference.href
          )
        ).toEqual([`${SITE_ORIGIN}/${page?.locale}/${page?.slug}`]);
        expect(getSourceReferencesFromMessages(messages)).toEqual([]);
      })
  );
});

describe("the report of the release gate", () => {
  it("says that the gate passed under its table", () => {
    expect(renderReport({ failures: [], table: "the table" })).toBe(
      "the table\n\nThe gate passed."
    );
  });

  it("lists each failure on a line of its own", () => {
    expect(
      renderReport({ failures: ["first", "second"], table: "the table" })
    ).toBe("the table\n\nThe gate failed:\n- first\n- second");
  });
});
