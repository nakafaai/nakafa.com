import { afterEach, describe, expect, it } from "@effect/vitest";
import { researchMaxSources } from "@repo/backend/client/nina/research";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import {
  ResearchOutputSchema,
  WebSearchInputSchema,
} from "@repo/backend/confect/nina/research/schema";
import { scrapeUrl } from "@repo/backend/confect/nina/research/tools/scrape";
import { searchWeb } from "@repo/backend/confect/nina/research/tools/search";
import { provider } from "@repo/backend/test/gateway";
import {
  providerStep,
  recordProgress,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, MutableList, Schema } from "effect";

vi.mock("@repo/backend/confect/nina/research/tools/search", () => ({
  searchWeb: vi.fn(),
}));
vi.mock(
  "@repo/backend/confect/nina/research/tools/scrape",
  async (original) => ({
    ...(await original<
      typeof import("@repo/backend/confect/nina/research/tools/scrape")
    >()),
    scrapeUrl: vi.fn(),
  })
);
afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});
const url = "https://ai-sdk.dev/docs/agents";
const source = { href: url, hostname: "ai-sdk.dev", text: url };
const output = {
  findings: [
    {
      text: "Verified finding.",
      citations: [{ title: "Official source", url }],
    },
    {
      text: "Invented finding.",
      citations: [
        { title: "Unretrieved", url: "https://example.com/unretrieved" },
      ],
    },
  ],
  limitations: [],
};
const encodeSearchInput = Schema.encodeSync(
  Schema.fromJsonString(WebSearchInputSchema)
);
const encodeResearchOutput = Schema.encodeSync(
  Schema.fromJsonString(ResearchOutputSchema)
);
const searchCall = providerStep(
  [
    {
      type: "tool-call",
      toolCallId: "search",
      toolName: "webSearch",
      input: encodeSearchInput({
        queries: ["official agents"],
        sourcePreference: "primary",
      }),
    },
  ],
  "tool-calls"
);
const final = providerStep([
  { type: "text", text: encodeResearchOutput(output) },
]);
const unusable = providerStep([{ type: "text", text: "Invalid JSON" }]);
const found = Effect.succeed({
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
const nothing = Effect.succeed({
  text: "No web result.",
  result: { sources: [], error: undefined },
});
const unavailable = Effect.succeed({
  text: "Search failed.",
  result: { sources: [], error: "Unavailable" },
});
const read = Effect.succeed({
  data: { url, content: "Exact source text." },
  error: undefined,
});
const unread = Effect.succeed({
  data: { url, content: "" },
  error: "Unavailable",
});

/** Runs research over one scripted model and reports its provider calls. */
async function research(
  steps: ConstructorParameters<typeof MockLanguageModelV4>[0],
  sourceReferences: (typeof source)[] = []
) {
  const model = new MockLanguageModelV4(steps);
  provider.languageModel.mockReturnValue(model);
  const result = await runSpecialist((userId) =>
    runResearchAgent({
      ...specialistRequest,
      userId,
      sourceReferences,
      toolCallId: "research",
      publish: () => Effect.void,
      usageHandler: vi.fn(),
    }).pipe(
      Effect.catchTag("ResearchGenerationError", (error) =>
        Effect.succeed({ failed: error.phase, message: error.message })
      )
    )
  );
  return { calls: model.doGenerateCalls, result };
}

describe("research Agent evidence boundary", () => {
  it("searches once, synthesizes once and keeps only retrieved citations", async () => {
    vi.mocked(searchWeb).mockReturnValue(found);
    vi.mocked(scrapeUrl).mockReturnValue(read);
    const model = new MockLanguageModelV4({
      doGenerate: [searchCall, final],
    });
    provider.languageModel.mockReturnValue(model);
    const usageHandler = vi.fn();
    const { artifacts, publish } = recordProgress();
    const result = await runSpecialist((userId) =>
      runResearchAgent({
        ...specialistRequest,
        userId,
        task: `Verify ${url}`,
        sourceReferences: Array.from(
          { length: researchMaxSources },
          (_, i) => ({
            ...source,
            href: i === 0 ? url : `${url}/${i}`,
          })
        ),
        toolCallId: "research",
        publish,
        usageHandler,
      })
    );
    expect(result).toEqual({
      text: `- Verified finding. [Official source](${url})`,
    });
    expect(scrapeUrl).toHaveBeenCalledTimes(researchMaxSources);
    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(usageHandler).toHaveBeenCalledTimes(2);
    expect(MutableList.toArray(artifacts)).toEqual([]);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[0]?.toolChoice).toEqual({
      type: "tool",
      toolName: "webSearch",
    });
    expect(
      Arr.map(model.doGenerateCalls[0]?.tools ?? [], (tool) => tool.name)
    ).toEqual(["webSearch"]);
    expect(model.doGenerateCalls[1]?.tools ?? []).toEqual([]);
    const synthesisPrompt = encodeJsonText(model.doGenerateCalls[1]?.prompt);
    expect(synthesisPrompt).toContain("Exact source text.");
    expect(synthesisPrompt).toContain("Inspectable source evidence.");
  });

  it("rejects excess exact sources before any provider call without silently dropping URLs", async () => {
    const sources = Array.from({ length: researchMaxSources + 1 }, (_, i) => ({
      ...source,
      href: `${url}/${i}`,
    }));
    const failure = await runSpecialist((userId) =>
      runResearchAgent({
        ...specialistRequest,
        userId,
        sourceReferences: sources,
        toolCallId: "research",
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(
        Effect.catchTag("ResearchSourceLimitError", (error) =>
          Effect.succeed({
            _tag: error._tag,
            maximum: error.maximum,
            received: error.received,
          })
        )
      )
    );
    expect(failure).toMatchObject({
      _tag: "ResearchSourceLimitError",
      maximum: researchMaxSources,
      received: researchMaxSources + 1,
    });
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(scrapeUrl).not.toHaveBeenCalled();
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("ends as empty without a synthesis call when the search finds no source", async () => {
    vi.mocked(searchWeb).mockReturnValue(nothing);
    const { calls, result } = await research({ doGenerate: [searchCall] });
    expect(result).toEqual({
      outcome: "empty",
      text: expect.stringContaining(
        "Research returned no source-backed finding."
      ),
    });
    expect(calls).toHaveLength(1);
  });

  it("ends as empty when synthesis keeps no finding that cites a retrieved source", async () => {
    vi.mocked(searchWeb).mockReturnValue(found);
    const { calls, result } = await research({
      doGenerate: [
        searchCall,
        providerStep([
          {
            type: "text",
            text: encodeResearchOutput({
              findings: [output.findings[1]],
              limitations: ["The official page did not state a date."],
            }),
          },
        ]),
      ],
    });
    expect(result).toEqual({
      outcome: "empty",
      text: expect.stringContaining(
        "- The official page did not state a date."
      ),
    });
    expect(result).not.toHaveProperty(
      "text",
      expect.stringContaining("Invented finding.")
    );
    expect(calls).toHaveLength(2);
  });

  it("hands the retrieved sources to Nina, without a retry, when synthesis is unusable", async () => {
    vi.mocked(searchWeb).mockReturnValue(found);
    const { calls, result } = await research({
      doGenerate: [searchCall, unusable],
    });
    expect(result).toEqual({
      outcome: "partial",
      text: expect.stringContaining("Inspectable source evidence."),
    });
    expect(calls).toHaveLength(2);
  });

  it("answers from the learner's own source as partial when the search step fails", async () => {
    vi.mocked(scrapeUrl).mockReturnValue(read);
    let call = 0;
    const { calls, result } = await research(
      {
        doGenerate: () => {
          call += 1;
          return call === 1
            ? Promise.reject(new Error("Provider failed"))
            : Promise.resolve(final);
        },
      },
      [source]
    );
    expect(result).toEqual({
      outcome: "partial",
      text: `- Verified finding. [Official source](${url})`,
    });
    expect(searchWeb).not.toHaveBeenCalled();
    expect(calls).toHaveLength(2);
  });

  it.each([
    [
      "the provider rejects the search step",
      "Research search generation failed.",
    ],
    [
      "the search provider is unavailable",
      "Research search returned no source.",
    ],
  ] as const)(
    "fails in the search phase with nothing usable when %s",
    async (reason, message) => {
      vi.mocked(searchWeb).mockReturnValue(unavailable);
      vi.mocked(scrapeUrl).mockReturnValue(unread);
      const { calls, result } = await research(
        {
          doGenerate: () =>
            reason === "the provider rejects the search step"
              ? Promise.reject(new Error("Provider failed"))
              : Promise.resolve(searchCall),
        },
        [source]
      );
      expect(result).toEqual({ failed: "search", message });
      expect(calls).toHaveLength(1);
    }
  );
});
