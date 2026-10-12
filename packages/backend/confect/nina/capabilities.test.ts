import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { Agent } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { researchMaxSources } from "@repo/backend/client/nina/research";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { createCapabilities } from "@repo/backend/confect/nina/capabilities";
import { runMathAgent } from "@repo/backend/confect/nina/math/agent";
import { MathGenerationError } from "@repo/backend/confect/nina/math/error";
import { runMemory } from "@repo/backend/confect/nina/memory/tool";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import { NakafaGenerationError } from "@repo/backend/confect/nina/nakafa/error";
import { MEMORY_PAUSED } from "@repo/backend/confect/nina/policy/capability";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import {
  ResearchGenerationError,
  ResearchSourceLimitError,
} from "@repo/backend/confect/nina/research/schema";
import { GatewayTest } from "@repo/backend/test/gateway";
import { type createNinaTest, ninaToolInput } from "@repo/backend/test/nina";
import { inNewChatStep } from "@repo/backend/test/nina/deadline";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import {
  openHomeSession,
  providerStep,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { isStepCount } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import {
  Array as Arr,
  Effect,
  Logger,
  MutableHashMap,
  MutableRef,
  Option,
} from "effect";

vi.mock("@repo/backend/confect/nina/math/agent", () => ({
  runMathAgent: vi.fn(),
}));
vi.mock("@repo/backend/confect/nina/memory/tool", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/memory/tool")>();
  return { ...actual, runMemory: vi.fn(actual.runMemory) };
});
vi.mock("@repo/backend/confect/nina/nakafa/agent", () => ({
  runNakafaAgent: vi.fn(),
}));
vi.mock("@repo/backend/confect/nina/research/agent", () => ({
  runResearchAgent: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

const request = providerStep([
  { type: "text", text: "Answer from tool evidence." },
]);
const toolInputs = {
  nakafa: ninaToolInput,
  math: {
    request: ninaToolInput.request,
    objective: ninaToolInput.objective,
    given: ["x + x"],
  },
  deepResearch: {
    request: ninaToolInput.request,
    objective: ninaToolInput.objective,
    sourceRequirements: ["primary sources"],
  },
};
function toolCall(toolName: string, input: object, toolCallId = "capability") {
  return providerStep(
    [
      {
        type: "tool-call",
        toolName,
        toolCallId,
        input: encodeJsonText(input),
      },
    ],
    "tool-calls"
  );
}

/**
 * Plays a scripted model through the real Agent, with the capability tools of
 * one learner, and returns what its tool calls produced and what the turn
 * logged. The memory tool leaves the words it finds in `found`, as in a turn.
 */
function playTurn({
  context,
  found = MutableHashMap.empty<string, string>(),
  model,
  prompt,
  userId,
}: {
  readonly context: Parameters<typeof createCapabilities>[1];
  readonly found?: Parameters<typeof createCapabilities>[4];
  readonly model: MockLanguageModelV4;
  readonly prompt: string;
  readonly userId: Parameters<typeof createCapabilities>[0];
}) {
  const logged = MutableRef.make<readonly unknown[]>([]);
  return Effect.gen(function* () {
    const tools = yield* createCapabilities(
      userId,
      context,
      "en",
      vi.fn(),
      found
    );
    const ctx = yield* ActionCtx;
    const generated = yield* Effect.promise(() =>
      new Agent(components.nina, {
        name: "test",
        languageModel: model,
        tools,
        stopWhen: isStepCount(3),
      }).generateText(ctx, { userId }, { prompt })
    );
    return {
      logged,
      result: Arr.map(generated.toolResults, ({ output }) => output),
    };
  }).pipe(
    inNewChatStep,
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
}

/**
 * Runs one capability through a scripted turn in one state and returns what
 * the model's tool call produced and what the turn logged.
 */
async function runCapability(
  capability: keyof typeof toolInputs,
  state: "allowed" | "denied" | "failed" | "missing" | "sourceLimit",
  prompt = "Use the requested capability."
) {
  vi.mocked(runNakafaAgent).mockReturnValue(
    state === "failed"
      ? Effect.fail(
          new NakafaGenerationError({
            cause: undefined,
            message: "Private provider detail",
          })
        )
      : Effect.succeed({ text: "Verified content." })
  );
  vi.mocked(runMathAgent).mockReturnValue(
    state === "failed"
      ? Effect.fail(
          new MathGenerationError({
            cause: undefined,
            message: "Private provider detail",
          })
        )
      : Effect.succeed({ text: "Verified calculation." })
  );
  if (state === "sourceLimit") {
    vi.mocked(runResearchAgent).mockReturnValue(
      Effect.fail(
        new ResearchSourceLimitError({
          maximum: researchMaxSources,
          received: researchMaxSources + 1,
        })
      )
    );
  } else {
    vi.mocked(runResearchAgent).mockReturnValue(
      state === "failed"
        ? Effect.fail(
            new ResearchGenerationError({
              phase: "search",
              message: "Private provider detail",
              rejected: false,
            })
          )
        : Effect.succeed({ text: "Verified source." })
    );
  }
  const model = new MockLanguageModelV4({
    doGenerate: [toolCall(capability, toolInputs[capability]), request],
  });
  return runSpecialist((userId) =>
    Effect.gen(function* () {
      const session = yield* openHomeSession;
      return yield* playTurn({
        context: {
          ...specialistRequest.context,
          nina:
            state === "missing"
              ? undefined
              : {
                  ...session.context,
                  tools: {
                    ...session.context.tools,
                    allowNakafa: state !== "denied",
                    allowMath: state !== "denied",
                    allowDeepResearch: state !== "denied",
                  },
                },
        },
        model,
        prompt,
        userId,
      });
    })
  );
}

describe("Nina capability execution policy", () => {
  for (const capability of ["nakafa", "math", "deepResearch"] as const) {
    const states =
      capability === "deepResearch"
        ? (["allowed", "denied", "failed", "missing", "sourceLimit"] as const)
        : (["allowed", "denied", "failed", "missing"] as const);
    it.each(states)(
      `${capability} keeps %s execution within the authenticated turn`,
      async (state) => {
        const { logged, result } = await runCapability(capability, state);
        // Only a failed run is logged, as routing facts without the provider's words.
        expect(MutableRef.get(logged)).toEqual(
          state === "failed"
            ? [
                [
                  "Nina capability failed",
                  expect.objectContaining({ capability }),
                ],
              ]
            : []
        );
        expect(encodeJsonText(MutableRef.get(logged))).not.toContain(
          "Private provider detail"
        );
        expect(result).toHaveLength(1);
        expect(encodeJsonText(result)).not.toContain("Private provider detail");
        if (state === "denied" || state === "missing") {
          expect(result[0]).toMatchObject({
            outcome: "denied",
            text: expect.stringContaining("Status: denied"),
          });
          expect(runNakafaAgent).not.toHaveBeenCalled();
          expect(runMathAgent).not.toHaveBeenCalled();
          expect(runResearchAgent).not.toHaveBeenCalled();
        } else {
          const called = {
            nakafa: runNakafaAgent,
            math: runMathAgent,
            deepResearch: runResearchAgent,
          }[capability];
          expect(called).toHaveBeenCalledWith(
            expect.objectContaining({
              userId: expect.any(String),
              locale: "en",
            })
          );
          const expectedText = {
            allowed: "Verified",
            failed: "failed",
            sourceLimit: `at most ${researchMaxSources}`,
          }[state];
          expect(result[0]).toMatchObject({
            text: expect.stringContaining(expectedText),
          });
          if (state === "sourceLimit") {
            expect(result[0]).toHaveProperty("outcome", "limit");
          } else if (state === "failed") {
            expect(result[0]).toHaveProperty("outcome", "failed");
          } else {
            expect(result[0]).not.toHaveProperty("outcome");
          }
        }
      }
    );
  }

  describe("a learner's links", () => {
    const lesson =
      "https://nakafa.com/en/subject/high-school/10/mathematics/exponential/basic-concept";
    const outside = "https://ai-sdk.dev/docs/ai-sdk-core/devtools";

    it("hands a link to Nakafa's own site to the Nakafa capability, as the address to read", async () => {
      await runCapability("nakafa", "allowed", `Explain ${lesson}.`);

      expect(runNakafaAgent).toHaveBeenCalledWith(
        expect.objectContaining({ addresses: [lesson] })
      );
    });

    it("hands it as the address on the production origin, whatever scheme or alias the learner wrote", async () => {
      await runCapability(
        "nakafa",
        "allowed",
        `Explain ${lesson.replace("https://", "http://www.")}.`
      );

      expect(runNakafaAgent).toHaveBeenCalledWith(
        expect.objectContaining({ addresses: [lesson] })
      );
    });

    it("never hands a link to Nakafa's own site to web research to scrape", async () => {
      await runCapability("deepResearch", "allowed", `Explain ${lesson}.`);

      expect(runResearchAgent).toHaveBeenCalledWith(
        expect.objectContaining({ sourceReferences: [] })
      );
    });

    it("hands a page of Nakafa's own site that signed content does not hold to Nakafa as well, and never to research", async () => {
      const page = "https://nakafa.com/en/try-out/snbt/2026/set-1";
      await runCapability("nakafa", "allowed", `What is ${page}?`);
      await runCapability("deepResearch", "allowed", `What is ${page}?`);

      expect(runNakafaAgent).toHaveBeenCalledWith(
        expect.objectContaining({ addresses: [page] })
      );
      expect(runResearchAgent).toHaveBeenCalledWith(
        expect.objectContaining({ sourceReferences: [] })
      );
    });

    it("splits a message that holds both: the outside link to research, the Nakafa link to Nakafa", async () => {
      const both = `Compare ${lesson} with ${outside}.`;
      await runCapability("deepResearch", "allowed", both);
      await runCapability("nakafa", "allowed", both);

      expect(runResearchAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceReferences: [expect.objectContaining({ href: outside })],
        })
      );
      expect(runNakafaAgent).toHaveBeenCalledWith(
        expect.objectContaining({ addresses: [lesson] })
      );
      expect(runNakafaAgent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          addresses: expect.arrayContaining([outside]),
        })
      );
    });

    it("hands no address when the learner sent no Nakafa link", async () => {
      await runCapability("nakafa", "allowed");

      expect(runNakafaAgent).toHaveBeenCalledWith(
        expect.objectContaining({ addresses: [] })
      );
    });
  });

  it("tells Nina what this attempt could not verify and to name a direct channel when external research fails, without an absence claim", async () => {
    const { result } = await runCapability("deepResearch", "failed");

    expect(result[0]).toMatchObject({
      outcome: "failed",
      text: expect.stringContaining(
        "Tell the learner what this attempt could not verify, which is the request itself, and name a direct channel they can check next."
      ),
    });
    expect(result[0]).toMatchObject({
      text: expect.stringContaining(
        "do not claim that anything is absent or does not exist"
      ),
    });
  });
});

describe("Nina memory capability execution", () => {
  const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

  /**
   * Plays a model that searches the memories of the fixture's learner once, and
   * answers, in a turn whose context says that memory is on unless `memory` says
   * otherwise. It returns what the turn produced and the words the search left
   * for the model's next step.
   */
  async function search(
    f: Awaited<ReturnType<typeof createNinaTest>>,
    { memory = true }: { readonly memory?: boolean } = {}
  ) {
    const found = MutableHashMap.empty<string, string>();
    const model = new MockLanguageModelV4({
      doGenerate: [toolCall("memory", { query: "snbt" }), request],
    });
    const played = await f.t.action((ctx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const session = yield* openHomeSession;
          return yield* playTurn({
            context: {
              ...specialistRequest.context,
              memory,
              nina: session.context,
            },
            found,
            model,
            prompt: "What do you remember about my exam?",
            userId: f.identity.userId,
          });
        }).pipe(
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
          ])
        )
      )
    );
    return { ...played, found };
  }

  it("hands the next step the memories that match its query, and leaves none of their words in the result the conversation stores", async () => {
    const f = await createMemoryTest();
    await f.seed({
      confirmedAt: Date.UTC(2026, 8, 1),
      text: "Mau ikut SNBT 2027",
    });
    await f.seed({ text: "Hobi main gitar" });
    const { found, logged, result } = await search(f);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("outcome");
    expect(encodeJsonText(result)).not.toContain("SNBT");
    const words = Option.getOrThrow(MutableHashMap.get(found, "capability"));
    expect(words).toContain("- Mau ikut SNBT 2027 (2026-09-01)");
    expect(words).not.toContain("Hobi main gitar");
    expect(MutableRef.get(logged)).toEqual([]);
  });

  it("says that nothing was found, and marks the run as empty, for a learner who told Nina nothing", async () => {
    const f = await createMemoryTest();
    const { found, result } = await search(f);
    expect(result).toMatchObject([{ outcome: "empty" }]);
    expect(MutableHashMap.size(found)).toBe(0);
  });

  it("refuses a call under the policy of a turn whose memory is off, without reading any memory", async () => {
    vi.mocked(runMemory).mockClear();
    const f = await createMemoryTest();
    await f.seed({ text: "Mau ikut SNBT 2027" });
    const { found, logged, result } = await search(f, { memory: false });
    expect(result).toMatchObject([{ outcome: "denied" }]);
    expect(encodeJsonText(result)).toContain("Status: denied");
    expect(encodeJsonText(result)).not.toContain("Mau ikut SNBT 2027");
    expect(runMemory).not.toHaveBeenCalled();
    expect(MutableHashMap.size(found)).toBe(0);
    expect(MutableRef.get(logged)).toEqual([]);
  });

  it("refuses a call, with the same denial, when the learner paused memory after the turn began", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Mau ikut SNBT 2027" });
    await f.owner.mutation(pause, { paused: true });
    const { found, logged, result } = await search(f);
    expect(result).toMatchObject([{ outcome: "denied" }]);
    expect(encodeJsonText(result)).toContain("Status: denied");
    expect(encodeJsonText(result)).toContain(MEMORY_PAUSED.reason);
    expect(encodeJsonText(result)).not.toContain("Mau ikut SNBT 2027");
    expect(MutableHashMap.size(found)).toBe(0);
    expect(MutableRef.get(logged)).toEqual([]);
  });

  it("tells Nina it could not read memory, and logs only where it failed, when the read dies", async () => {
    vi.mocked(runMemory).mockReturnValueOnce(
      Effect.die(new Error("Private storage detail"))
    );
    const f = await createMemoryTest();
    const { logged, result } = await search(f);
    expect(result).toMatchObject([{ outcome: "failed" }]);
    expect(MutableRef.get(logged)).toEqual([
      [
        "Nina capability failed",
        expect.objectContaining({ capability: "memory", phase: "read" }),
      ],
    ]);
    expect(encodeJsonText(result)).not.toContain("Private storage detail");
    expect(encodeJsonText(MutableRef.get(logged))).not.toContain(
      "Private storage detail"
    );
  });
});
