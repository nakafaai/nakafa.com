import { afterEach, describe, expect, it } from "@effect/vitest";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import { researchMaxSources } from "@repo/backend/confect/nina/research/schema";
import { scrapeUrl } from "@repo/backend/confect/nina/research/tools/scrape";
import { searchWeb } from "@repo/backend/confect/nina/research/tools/search";
import { provider } from "@repo/backend/test/gateway";
import {
  providerStep,
  recordProgress,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect } from "effect";

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
  noEvidenceAnswer:
    "I could not verify this from the requested direct sources.",
};
const searchCall = providerStep(
  [
    {
      type: "tool-call",
      toolCallId: "search",
      toolName: "webSearch",
      input: JSON.stringify({
        queries: ["official agents"],
        sourcePreference: "primary",
      }),
    },
  ],
  "tool-calls"
);
const evidenceNotes = providerStep([{ type: "text", text: "Evidence notes." }]);
const final = providerStep([{ type: "text", text: JSON.stringify(output) }]);

describe("research Agent evidence boundary", () => {
  it("searches once with webSearch and keeps only retrieved citations", async () => {
    vi.mocked(searchWeb).mockReturnValue(
      Effect.succeed({
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
      })
    );
    vi.mocked(scrapeUrl).mockReturnValue(
      Effect.succeed({
        data: { url, content: "Exact source text." },
        error: undefined,
      })
    );
    const model = new MockLanguageModelV4({
      doGenerate: [searchCall, evidenceNotes, final],
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
    expect(result.text).toContain("Verified finding.");
    expect(result.text).not.toContain("Invented finding.");
    expect(scrapeUrl).toHaveBeenCalledTimes(researchMaxSources);
    expect(usageHandler).toHaveBeenCalledTimes(3);
    expect(artifacts).toEqual([]);
    expect(model.doGenerateCalls[0]?.toolChoice).toEqual({
      type: "tool",
      toolName: "webSearch",
    });
    expect(
      Arr.map(model.doGenerateCalls[0]?.tools ?? [], (tool) => tool.name)
    ).toEqual(["webSearch"]);
    expect(model.doGenerateCalls[1]?.tools ?? []).toEqual([]);
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

  it("does not convert uncited provider notes or failed scrapes into factual claims", async () => {
    vi.mocked(searchWeb).mockReturnValue(
      Effect.succeed({
        text: "Search failed.",
        result: { sources: [], error: "Unavailable" },
      })
    );
    vi.mocked(scrapeUrl).mockReturnValue(
      Effect.succeed({ data: { url, content: "" }, error: "Unavailable" })
    );
    const model = new MockLanguageModelV4({
      doGenerate: [
        searchCall,
        providerStep([{ type: "text", text: "Unverified provider claim." }]),
        final,
      ],
    });
    provider.languageModel.mockReturnValue(model);
    const result = await runSpecialist((userId) =>
      runResearchAgent({
        ...specialistRequest,
        userId,
        sourceReferences: [source],
        toolCallId: "research",
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      })
    );
    expect(result).toEqual({ text: output.noEvidenceAnswer });
    expect(JSON.stringify(model.doGenerateCalls[2]?.prompt)).not.toContain(
      "Unverified provider claim."
    );
  });

  it.each(["evidence", "synthesis"] as const)(
    "retains a typed %s failure and accounts for attempted output",
    async (phase) => {
      vi.mocked(searchWeb).mockReturnValue(
        Effect.succeed({
          text: "Empty",
          result: { sources: [], error: undefined },
        })
      );
      let calls = 0;
      const model = new MockLanguageModelV4({
        doGenerate: () => {
          calls += 1;
          if (phase === "evidence") {
            return Promise.reject(new Error("Provider failed"));
          }
          if (calls === 1) {
            return Promise.resolve(searchCall);
          }
          if (calls === 2) {
            return Promise.resolve(evidenceNotes);
          }
          return Promise.resolve(
            providerStep([{ type: "text", text: "Invalid JSON" }])
          );
        },
      });
      provider.languageModel.mockReturnValue(model);
      const error = await runSpecialist((userId) =>
        runResearchAgent({
          ...specialistRequest,
          userId,
          sourceReferences: [],
          toolCallId: "research",
          publish: () => Effect.void,
          usageHandler: vi.fn(),
        }).pipe(
          Effect.flip,
          Effect.map((failure) => ({
            _tag: failure._tag,
            ...("phase" in failure ? { phase: failure.phase } : {}),
          }))
        )
      );
      expect(error).toEqual({ _tag: "ResearchGenerationError", phase });
      expect(calls).toBe(phase === "synthesis" ? 6 : 1);
    }
  );
});
