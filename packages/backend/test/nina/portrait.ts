import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { buildPortrait } from "@repo/backend/confect/nina/portrait/build";
import {
  PORTRAIT_DELAY,
  PORTRAIT_FIELD,
  readPortrait,
} from "@repo/backend/confect/nina/portrait/store";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { GatewayTest, provider } from "@repo/backend/test/gateway";
import type { createNinaTest } from "@repo/backend/test/nina";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Logger,
  MutableRef,
} from "effect";

export const build = Ref.getFunctionReference(
  refs.internal.nina.portrait.build.run
);
export const claim = Ref.getFunctionReference(
  refs.internal.nina.portrait.claim
);
export const save = Ref.getFunctionReference(refs.internal.nina.portrait.save);

/** A model that answers every portrait build with this text, and counts its calls. */
export function writes(portrait: string) {
  const model = new MockLanguageModelV4({
    doGenerate: providerStep([
      { type: "text", text: encodeJsonText({ portrait }) },
    ]),
  });
  provider.languageModel.mockReturnValue(model);
  return model;
}

/**
 * A model that answers every portrait build with this text, but reports no
 * token counters, as a provider may leave them out.
 */
export function writesUncounted(portrait: string) {
  const model = new MockLanguageModelV4({
    doGenerate: {
      ...providerStep([{ type: "text", text: encodeJsonText({ portrait }) }]),
      usage: {
        inputTokens: {
          cacheRead: undefined,
          cacheWrite: undefined,
          noCache: undefined,
          total: undefined,
        },
        outputTokens: {
          reasoning: undefined,
          text: undefined,
          total: undefined,
        },
      },
    },
  });
  provider.languageModel.mockReturnValue(model);
  return model;
}

/**
 * A model that answers every portrait build with this text, but only after
 * `meanwhile` ran: the learner doing something while the model writes.
 */
export function writesAfter(
  meanwhile: () => Promise<unknown>,
  portrait: string
) {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      await meanwhile();
      return providerStep([
        { type: "text", text: encodeJsonText({ portrait }) },
      ]);
    },
  });
  provider.languageModel.mockReturnValue(model);
  return model;
}

type NinaTest = Awaited<ReturnType<typeof createNinaTest>>;

/** The text of the prompt of a model's first call. */
export function promptOf(model: MockLanguageModelV4, call = 0) {
  return encodeJsonText(model.doGenerateCalls[call]?.prompt);
}

/** The portrait builds a fixture has scheduled and that have not run, with the learner each is for. */
export async function scheduledBuilds(f: Pick<NinaTest, "t">) {
  return Arr.map(
    Arr.filter(
      await f.t.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      ),
      ({ name }) => name === "nina/portrait/build:run"
    ),
    ({ args: [args] }) => args
  );
}

/** A memory fixture with the helpers to read and build a learner's portrait. */
export async function createPortraitTest() {
  const f = await createMemoryTest();
  /** The portrait rows as stored. */
  const rows = () =>
    f.t.query((ctx) => ctx.db.query("ninaMemoryPortraits").collect());
  /** The opened text of the learner's portrait, or null when they have none. */
  const portrait = async (userId = f.identity.userId) =>
    (await f.execute(readPortrait(userId))) ?? null;
  const scheduled = () => scheduledBuilds(f);
  /**
   * Inserts the portrait row of a learner, with its text sealed as the product
   * seals it when `text` is given. A request is waiting from the beginning of
   * time, and no build has gone to the model, unless the row says otherwise.
   */
  const seedPortrait = ({
    builtAt,
    scheduledAt = 0,
    text,
    through = 0,
    userId = f.identity.userId,
  }: {
    readonly builtAt?: number;
    readonly scheduledAt?: number;
    readonly text?: string;
    readonly through?: number;
    readonly userId?: Docs["users"]["_id"];
  } = {}) =>
    f.execute(
      Effect.gen(function* () {
        const keys = yield* ensureLearnerKeys(userId);
        yield* (yield* DatabaseWriter).table("ninaMemoryPortraits").insert({
          ...(builtAt === undefined ? {} : { builtAt }),
          scheduledAt,
          through,
          userId,
          ...(text === undefined
            ? {}
            : { text: yield* sealText(keys, PORTRAIT_FIELD, text) }),
        });
      })
    );
  /** What the builds logged. */
  const logged = MutableRef.make<readonly unknown[]>([]);
  /** Builds the portrait of a learner, as the scheduled function does, and records what it logs. */
  const buildNow = (userId = f.identity.userId) =>
    f.t.action((ctx) =>
      Effect.runPromise(
        buildPortrait(userId).pipe(
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
  /** Runs the scheduled function itself, which a request schedules. */
  const runScheduled = (userId = f.identity.userId) =>
    f.t.action(build, { userId });
  /** Moves the clock on by `extra`, and a second more than a requested build waits. */
  const quiet = (extra = Duration.zero) =>
    vi.setSystemTime(
      DateTime.toEpochMillis(DateTime.nowUnsafe()) +
        Duration.toMillis(PORTRAIT_DELAY) +
        Duration.toMillis(extra) +
        1000
    );
  return {
    ...f,
    build: buildNow,
    logged,
    portrait,
    quiet,
    rows,
    runScheduled,
    scheduled,
    seedPortrait,
  };
}
