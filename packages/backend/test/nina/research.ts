import type { ResearchAgentData } from "@repo/backend/confect/nina/contract/agent";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import { formatWebSearchOutput } from "@repo/backend/confect/nina/research/search/format";
import { provider } from "@repo/backend/test/gateway";
import { withTimeLeft } from "@repo/backend/test/nina/deadline";
import {
  researchRequest,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Duration, Effect, Logger, MutableRef } from "effect";

/** The page that the scripted search finds and the scripted read returns. */
export const url = "https://ai-sdk.dev/docs/agents";

/** What the scripted search answers when it found the page. */
export const searchFound = Effect.succeed({
  text: "Inspectable source evidence.",
  result: {
    error: undefined,
    sources: [
      {
        url,
        title: "Official source",
        citation: "Official",
        content: "Verified source.",
        description: "Direct evidence",
      },
    ],
  },
});

/** What the scripted search answers when it found no page. */
export const searchNothing = Effect.succeed({
  text: "No web result.",
  result: { sources: [], error: undefined },
});

/** A search limited to a site, which found no page in it. */
const limited = { sites: Arr.make("ai-sdk.dev"), sources: [] };

/** What Nina is told when a search limited to a site found no page in it. */
export const limitNote = formatWebSearchOutput(limited);

/** What the scripted search answers when it was limited to a site and found no page in it. */
export const searchLimited = Effect.succeed({
  text: limitNote,
  result: limited,
});

/**
 * A search limited to a site, whose only result is an address that carries
 * credentials, so no citation may name it. It found a page in the site, so the
 * limit is not why nothing can be cited.
 */
const uncitable = {
  sites: limited.sites,
  sources: [
    {
      url: "https://reader:secret@ai-sdk.dev/docs/agents",
      title: "Private mirror",
      citation: "[ai-sdk.dev](https://reader:secret@ai-sdk.dev/docs/agents)",
      content: "Mirror text.",
      description: "A mirror that asks for a login.",
    },
  ],
};

/** What the scripted search answers when its only result is an address that no citation may name. */
export const searchUncitable = Effect.succeed({
  text: formatWebSearchOutput(uncitable),
  result: uncitable,
});

/** What the scripted search answers when the provider could not be reached. */
export const searchUnavailable = Effect.succeed({
  text: "Search failed.",
  result: { sources: [], error: "Unavailable" },
});

/** What the scripted read answers when it read the page. */
export const pageRead = Effect.succeed({
  data: { url, content: "Exact source text." },
  error: undefined,
});

/** What the scripted read answers when it could not read a page. */
export const pageUnread = Effect.succeed({
  data: { url: "https://example.org/unread", content: "" },
  error: "Unavailable",
});

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
