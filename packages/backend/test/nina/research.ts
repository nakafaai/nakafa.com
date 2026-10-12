import type { ResearchAgentData } from "@repo/backend/confect/nina/contract/agent";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import { provider } from "@repo/backend/test/gateway";
import { withTimeLeft } from "@repo/backend/test/nina/deadline";
import {
  researchRequest,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Duration, Effect, Logger, MutableRef } from "effect";

/**
 * Runs research over one scripted model; reports the model's calls and what the
 * run logged. A typed research failure comes back as its phase, message and
 * routing fact instead of failing the run.
 */
export async function runResearch(
  steps: ConstructorParameters<typeof MockLanguageModelV4>[0],
  sourceReferences: ResearchAgentData["sourceReferences"] = [],
  left: Duration.Input = Duration.infinity
) {
  const model = new MockLanguageModelV4(steps);
  provider.languageModel.mockReturnValue(model);
  const logged = MutableRef.make<readonly unknown[]>([]);
  const result = await runSpecialist((userId) =>
    runResearchAgent({
      ...researchRequest,
      userId,
      sourceReferences,
      publish: () => Effect.void,
      usageHandler: vi.fn(),
    }).pipe(
      withTimeLeft(left),
      Effect.catchTag("ResearchGenerationError", (error) =>
        Effect.succeed({
          failed: error.phase,
          message: error.message,
          rejected: error.rejected,
        })
      ),
      Effect.provide(
        Logger.layer([
          Logger.formatStructured.pipe(
            Logger.map(({ message }) =>
              MutableRef.update(logged, Arr.append(message))
            )
          ),
        ])
      )
    )
  );
  return {
    calls: model.doGenerateCalls,
    logged: MutableRef.get(logged),
    result,
  };
}
