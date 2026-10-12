import { RegisteredFunction } from "@confect/server";
import { expect } from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import ninaTurns from "@repo/backend/confect/_generated/tables/ninaTurns";
import { captureMemory } from "@repo/backend/confect/nina/memory/capture";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import { decides, GatewayTest, provider } from "@repo/backend/test/gateway";
import { createNinaTest } from "@repo/backend/test/nina";
import { memoryTools } from "@repo/backend/test/nina/memory";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Logger, MutableRef, Schema } from "effect";

/** What the learner says in a capture test, unless the test says something else. */
export const MESSAGE = "Aku kelas 12 dan mau ikut SNBT 2027.";

/** What the learner states: their level, quoted from `MESSAGE`. */
export const level: typeof NinaMemoryCandidate.Type = {
  kind: "level",
  quote: "Aku kelas 12",
  text: "Kelas 12.",
};

/** The log entry of a capture that saved nothing, with the routing facts it must hold. */
export const unavailable = (fact: object) => [
  ["Nina memory unavailable", expect.objectContaining(fact)],
];

/**
 * A decision model that finds the message lasting or not, and each candidate,
 * in the order they come, private or not. Its probabilities are far from every
 * threshold, so a test never depends on the number a threshold has.
 */
export function judges({
  lasting = true,
  privates = [],
}: {
  readonly lasting?: boolean;
  readonly privates?: readonly boolean[];
} = {}) {
  return decides((judgment, index) => {
    const yes = judgment === "lasting" ? lasting : privates[index] === true;
    return yes ? 0.99 : 0.01;
  });
}

/** A model that answers every capture call with these candidates. */
export function answers(...memories: (typeof NinaMemoryCandidate.Type)[]) {
  const model = new MockLanguageModelV4({
    doGenerate: providerStep([
      { type: "text", text: encodeJsonText({ memories }) },
    ]),
  });
  provider.languageModel.mockReturnValue(model);
  return model;
}

/**
 * A model that answers like `answers`, but only after `meanwhile` ran: the
 * learner doing something while the model reads the message.
 */
export function answersAfter(
  meanwhile: () => Promise<unknown>,
  ...memories: (typeof NinaMemoryCandidate.Type)[]
) {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      await meanwhile();
      return providerStep([
        { type: "text", text: encodeJsonText({ memories }) },
      ]);
    },
  });
  provider.languageModel.mockReturnValue(model);
  return model;
}

/** A model whose capture call fails with this. */
export function fails(error: () => Promise<never>) {
  const model = new MockLanguageModelV4({ doGenerate: error });
  provider.languageModel.mockReturnValue(model);
  return model;
}

/**
 * A learner who sent `prompt`, and a way to run one capture for that turn. The
 * decision model finds the message lasting and nothing private, until a test
 * says otherwise with `judges`.
 */
export async function createCapturingTest(prompt = MESSAGE) {
  const nina = await createNinaTest({ prompt });
  judges();
  const f = { ...nina, ...memoryTools(nina) };
  const logged = MutableRef.make<readonly unknown[]>([]);
  const readTurn = async () =>
    Schema.decodeUnknownSync(ninaTurns.Doc)(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId))
    );
  const capture = async (promptMessageId?: string) => {
    const turn = await readTurn();
    return f.t.action((ctx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const usageHandler = yield* createUsageHandler(turn._id);
          yield* captureMemory(
            promptMessageId === undefined ? turn : { ...turn, promptMessageId },
            usageHandler
          );
        }).pipe(
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
            Logger.layer([
              Logger.formatStructured.pipe(
                Logger.map(({ message }) =>
                  MutableRef.update(logged, Arr.append(message))
                )
              ),
            ]),
          ])
        )
      )
    );
  };
  const turn = () => f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId));
  return { ...f, capture, logged, turn };
}
