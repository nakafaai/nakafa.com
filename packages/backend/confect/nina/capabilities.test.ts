import { Agent } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { createCapabilities } from "@repo/backend/confect/nina/capabilities";
import { runMathAgent } from "@repo/backend/confect/nina/math/agent";
import { MathGenerationError } from "@repo/backend/confect/nina/math/error";
import { openNinaLearningSession } from "@repo/backend/confect/nina/memory/pack";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import { NakafaGenerationError } from "@repo/backend/confect/nina/nakafa/error";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import {
  ResearchGenerationError,
  ResearchSourceLimitError,
  researchMaxSources,
} from "@repo/backend/confect/nina/research/schema";
import { ninaToolInput } from "@repo/backend/test/nina";
import {
  providerStep,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { isStepCount } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/math/agent", () => ({
  runMathAgent: vi.fn(),
}));
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
function toolCall(
  toolName: keyof typeof toolInputs,
  toolCallId = "capability"
) {
  return providerStep(
    [
      {
        type: "tool-call",
        toolName,
        toolCallId,
        input: JSON.stringify(toolInputs[toolName]),
      },
    ],
    "tool-calls"
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
                    phase: "evidence",
                    message: "Private provider detail",
                  })
                )
              : Effect.succeed({ text: "Verified source." })
          );
        }
        const model = new MockLanguageModelV4({
          doGenerate: [toolCall(capability), request],
        });
        const result = await runSpecialist((userId) =>
          Effect.gen(function* () {
            const session = yield* openNinaLearningSession({
              capturedAt: "2026-09-27T12:00:00Z",
              source: "current-page",
              learning: {
                locale: "en",
                slug: "home",
                url: "https://nakafa.com/en/home",
                verified: false,
              },
            });
            const tools = yield* createCapabilities(
              userId,
              {
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
              "en",
              specialistRequest.modelId,
              vi.fn()
            );
            const ctx = yield* ActionCtx;
            const generated = yield* Effect.promise(() =>
              new Agent(components.nina, {
                name: "test",
                languageModel: model,
                tools,
                stopWhen: isStepCount(3),
              }).generateText(
                ctx,
                { userId },
                { prompt: "Use the requested capability." }
              )
            );
            return generated.toolResults.map(({ output }) => output);
          })
        );
        expect(result).toHaveLength(1);
        expect(JSON.stringify(result)).not.toContain("Private provider detail");
        if (state === "denied" || state === "missing") {
          expect(result[0]).toMatchObject({
            failure: "denied",
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
              modelId: specialistRequest.modelId,
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
            expect(result[0]).toHaveProperty("failure", "sourceLimit");
          } else if (state === "failed") {
            expect(result[0]).toHaveProperty("failure", "failed");
          } else {
            expect(result[0]).not.toHaveProperty("failure");
          }
        }
      }
    );
  }
});
