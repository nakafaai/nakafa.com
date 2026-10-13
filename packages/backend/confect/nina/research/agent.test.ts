import { Agent } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { researchMaxSources } from "@repo/backend/client/nina/research";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import { formatResearchOutput } from "@repo/backend/confect/nina/research/output";
import type { ResearchOutput } from "@repo/backend/confect/nina/research/schema";
import { scrapeUrl } from "@repo/backend/confect/nina/research/tools/scrape";
import { searchWeb } from "@repo/backend/confect/nina/research/tools/search";
import { provider } from "@repo/backend/test/gateway";
import { neverAnswering, withTimeLeft } from "@repo/backend/test/nina/deadline";
import { runResearch } from "@repo/backend/test/nina/research";
import {
  providerStep,
  recordProgress,
  researchRequest,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, MutableList } from "effect";

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
  vi.useRealTimers();
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
/** A search call whose input the model wrote as `input`, before any check. */
const searchCallWith = (input: unknown) =>
  providerStep(
    [
      {
        type: "tool-call",
        toolCallId: "search",
        toolName: "webSearch",
        input: encodeJsonText(input),
      },
    ],
    "tool-calls"
  );
const searchCall = searchCallWith({
  queries: ["official agents"],
  sites: ["ai-sdk.dev"],
});
/** One scripted synthesis answer, as the model would return it. */
const synthesis = (answer: ResearchOutput) =>
  providerStep([{ type: "text", text: encodeJsonText(answer) }]);
const final = synthesis(output);
const noDate = "The official page did not state a date.";
/** How the instruction Nina reads when research returns no source-backed finding begins. */
const noFindingStart =
  /^Research returned no source-backed finding\. Tell the learner what this attempt could not verify\./u;
const unusable = providerStep([{ type: "text", text: "Invalid JSON" }]);
const noQuery = searchCallWith({ queries: [] });
/**
 * Names far more sites than a call may, so the schema refuses the whole call.
 * `schema.test.ts` pins the exact bound.
 */
const tooManySites = searchCallWith({
  queries: ["official agents"],
  sites: Arr.makeBy(50, (index) => `site${index}.dev`),
});
/** Names a site by its name, not its hostname, next to a valid one. */
const noHostname = searchCallWith({
  queries: ["official agents"],
  sites: ["ai-sdk.dev", "AI SDK"],
});
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
/** A search limited to a site, which found no page in it. */
const limitedNothing = Effect.succeed({
  text: "The search was limited to ai-sdk.dev.",
  result: { sites: Arr.make("ai-sdk.dev"), sources: [], error: undefined },
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
  data: { url: "https://example.org/unread", content: "" },
  error: "Unavailable",
});

describe("research Agent evidence boundary", () => {
  it("searches once, in the sites the model named, synthesizes once and keeps only retrieved citations", async () => {
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
        ...researchRequest,
        userId,
        task: `Verify ${url}`,
        sourceReferences: Array.from(
          { length: researchMaxSources },
          (_, i) => ({
            ...source,
            href: i === 0 ? url : `${url}/${i}`,
          })
        ),
        publish,
        usageHandler,
      })
    );
    expect(result).toEqual({
      text: `- Verified finding. [Official source](${url})`,
    });
    expect(scrapeUrl).toHaveBeenCalledTimes(researchMaxSources);
    // The words choose the paragraphs of a page, in the search and in a link.
    expect(scrapeUrl).toHaveBeenCalledWith(
      expect.objectContaining({ selectionQuery: researchRequest.words })
    );
    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(searchWeb).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: ["official agents"],
        sites: ["ai-sdk.dev"],
        toolCallId: "search",
        words: researchRequest.words,
      })
    );
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

  it("cuts both of its model calls to the time the capability has left", async () => {
    vi.mocked(searchWeb).mockReturnValue(found);
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({ doGenerate: [searchCall, final] })
    );
    const generate = vi.spyOn(Agent.prototype, "generateText");
    await runSpecialist((userId) =>
      runResearchAgent({
        ...researchRequest,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(withTimeLeft("7 seconds"))
    );
    expect(Arr.map(generate.mock.calls, ([, , call]) => call.timeout)).toEqual([
      { stepMs: 7000, totalMs: 7000 },
      { stepMs: 7000, totalMs: 7000 },
    ]);
  });

  it("reads a full address in the task as a link, but not a site the task only names or a page of Nakafa's own site", async () => {
    vi.mocked(searchWeb).mockReturnValue(found);
    vi.mocked(scrapeUrl).mockReturnValue(read);
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({ doGenerate: [searchCall, final] })
    );
    await runSpecialist((userId) =>
      runResearchAgent({
        ...researchRequest,
        userId,
        task: `Cari di kemdikbud.go.id dan baca ${url} dan https://nakafa.com/en/articles/politics/example tentang kurikulum.`,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      })
    );
    expect(
      Arr.map(vi.mocked(scrapeUrl).mock.calls, ([read]) => read.url)
    ).toEqual([url]);
  });

  it("rejects excess exact sources before any provider call without silently dropping URLs", async () => {
    const sources = Array.from({ length: researchMaxSources + 1 }, (_, i) => ({
      ...source,
      href: `${url}/${i}`,
    }));
    const failure = await runSpecialist((userId) =>
      runResearchAgent({
        ...researchRequest,
        userId,
        sourceReferences: sources,
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

  it.each([
    ["an open search finds no source and adds nothing for Nina", nothing, ""],
    [
      "a search limited to sites finds no source and hands Nina what the limit means",
      limitedNothing,
      "\n\nThe search was limited to ai-sdk.dev.",
    ],
  ])(
    "ends as empty without a synthesis call when %s",
    async (_case, searched, limit) => {
      vi.mocked(searchWeb).mockReturnValue(searched);
      const { calls, result } = await runResearch({ doGenerate: [searchCall] });
      expect(result).toEqual({
        outcome: "empty",
        text: `${formatResearchOutput({ findings: [], limitations: [] })}${limit}`,
      });
      expect(calls).toHaveLength(1);
    }
  );

  it("hands Nina the closest thing the sources state, with its citation and the limitation, and is not empty", async () => {
    vi.mocked(searchWeb).mockReturnValue(found);
    const { calls, result } = await runResearch({
      doGenerate: [
        searchCall,
        synthesis({
          findings: [
            {
              text: "Version 5 of the guide lets an agent stop after a fixed number of steps.",
              citations: [{ title: "Official source", url }],
            },
          ],
          limitations: [
            "The collected sources describe version 5 and do not state version 6.",
          ],
        }),
      ],
    });
    expect(result).toEqual({
      text: `- Version 5 of the guide lets an agent stop after a fixed number of steps. [Official source](${url})\n\n- The collected sources describe version 5 and do not state version 6.`,
    });
    expect(result).not.toHaveProperty("outcome", "empty");
    expect(calls).toHaveLength(2);
    expect(encodeJsonText(calls[1]?.prompt)).toContain("closest thing");
  });

  it.each([
    ["returns no finding", { findings: [], limitations: [noDate] }],
    [
      "returns only a finding that cites a source it was not given",
      { findings: [output.findings[1]], limitations: [noDate] },
    ],
  ])(
    "is not empty when synthesis %s: Nina reads what this attempt could not verify",
    async (_case, answer) => {
      vi.mocked(searchWeb).mockReturnValue(found);
      const { calls, result } = await runResearch({
        doGenerate: [searchCall, synthesis(answer)],
      });
      expect(result).toEqual({ text: expect.stringMatching(noFindingStart) });
      expect(result).toEqual({
        text: expect.stringContaining(`\n\n- ${noDate}`),
      });
      expect(result).not.toHaveProperty("outcome", "empty");
      expect(calls).toHaveLength(2);
    }
  );

  it("hands the retrieved sources to Nina, without a retry, when synthesis is unusable", async () => {
    vi.mocked(searchWeb).mockReturnValue(found);
    const { calls, logged, result } = await runResearch({
      doGenerate: [searchCall, unusable],
    });
    expect(result).toEqual({
      outcome: "partial",
      text: expect.stringContaining("Inspectable source evidence."),
    });
    expect(calls).toHaveLength(2);
    expect(logged).toEqual([
      [
        "Nina research phase failed",
        expect.objectContaining({ phase: "synthesis", rejected: true }),
      ],
    ]);
    expect(encodeJsonText(logged)).not.toContain("Invalid JSON");
  });

  it("hands Nina what it gathered, as partial, when the synthesis call never answers within the time left", async () => {
    // Fake time drives the SDK's step timer, which ends a call that never answers.
    vi.useFakeTimers();
    vi.mocked(searchWeb).mockReturnValue(found);
    const hung = neverAnswering();
    // Only the search call forces a tool; the synthesis call never answers.
    const running = runResearch(
      {
        doGenerate: ({ abortSignal, toolChoice }) =>
          toolChoice?.type === "tool"
            ? Promise.resolve(searchCall)
            : hung.answer(abortSignal),
      },
      [],
      "10 seconds"
    );
    await hung.begun;
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await running).result).toEqual({
      outcome: "partial",
      text: expect.stringContaining("Inspectable source evidence."),
    });
  });

  it.each([
    [
      "the provider rejects the search step",
      () => Promise.reject(new Error("Private provider detail")),
      { phase: "search", reason: "unknown", rejected: false },
    ],
    [
      "the model writes no usable query",
      () => Promise.resolve(noQuery),
      { phase: "search", rejected: true },
    ],
    [
      "the model names more sites than a call may",
      () => Promise.resolve(tooManySites),
      { phase: "search", rejected: true },
    ],
    [
      "the model names a site that is not a hostname",
      () => Promise.resolve(noHostname),
      { phase: "search", rejected: true },
    ],
  ] as const)(
    "answers from the learner's own source as partial when %s",
    async (_reason, first, fact) => {
      vi.mocked(scrapeUrl).mockReturnValue(read);
      let call = 0;
      const { calls, logged, result } = await runResearch(
        {
          doGenerate: () => {
            call += 1;
            return call === 1 ? first() : Promise.resolve(final);
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
      expect(logged).toEqual([
        ["Nina research phase failed", expect.objectContaining(fact)],
      ]);
      expect(encodeJsonText(logged)).not.toContain("Private provider detail");
    }
  );

  it("never shows the model a learner's source that could not be read as evidence", async () => {
    vi.mocked(searchWeb).mockReturnValue(found);
    vi.mocked(scrapeUrl).mockReturnValue(unread);
    const { calls, result } = await runResearch(
      { doGenerate: [searchCall, final] },
      [source]
    );
    expect(result).toEqual({
      text: `- Verified finding. [Official source](${url})`,
    });
    expect(encodeJsonText(calls[0]?.prompt)).not.toContain(
      "https://example.org/unread"
    );
    const synthesisPrompt = encodeJsonText(calls[1]?.prompt);
    expect(synthesisPrompt).toContain("# Sources That Could Not Be Read");
    expect(synthesisPrompt).toContain("- https://example.org/unread");
    expect(synthesisPrompt).not.toContain("# Scrape Result");
  });

  it.each([
    [
      "the provider rejects the search step",
      () => Promise.reject(new Error("Provider failed")),
      { message: "Research search generation failed.", rejected: false },
    ],
    [
      "the model writes no usable query",
      () => Promise.resolve(noQuery),
      { message: "Research search wrote no usable query.", rejected: true },
    ],
    [
      "the model names more sites than a call may, so no search runs and none is widened",
      () => Promise.resolve(tooManySites),
      { message: "Research search wrote no usable query.", rejected: true },
    ],
    [
      "the model names a site that is not a hostname, so no search runs without it",
      () => Promise.resolve(noHostname),
      { message: "Research search wrote no usable query.", rejected: true },
    ],
    [
      "the search provider is unavailable",
      () => Promise.resolve(searchCall),
      { message: "Research search returned no source.", rejected: false },
    ],
  ] as const)(
    "fails in the search phase with nothing usable when %s",
    async (_reason, first, failure) => {
      vi.mocked(searchWeb).mockReturnValue(unavailable);
      vi.mocked(scrapeUrl).mockReturnValue(unread);
      const { calls, result } = await runResearch({ doGenerate: first }, [
        source,
      ]);
      expect(result).toEqual({ failed: "search", ...failure });
      expect(calls).toHaveLength(1);
    }
  );
});
