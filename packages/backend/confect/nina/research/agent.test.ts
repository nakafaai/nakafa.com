import { afterEach, describe, expect, it } from "@effect/vitest";
import { getGatewayModel } from "@repo/backend/confect/nina/config/provider";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import { scrapeUrl } from "@repo/backend/confect/nina/research/tools/scrape";
import { searchWeb } from "@repo/backend/confect/nina/research/tools/search";
import {
  providerStep,
  recordProgress,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/config/provider", () => ({
  getGatewayModel: vi.fn(),
}));
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
afterEach(() => vi.restoreAllMocks());
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
const groundingCall = providerStep(
  [
    {
      type: "tool-call",
      toolCallId: "google",
      toolName: "google_search",
      input: "{}",
      providerExecuted: true,
    },
    {
      type: "tool-result",
      toolCallId: "google",
      toolName: "google_search",
      result: {},
    },
  ],
  "tool-calls"
);
const final = providerStep([{ type: "text", text: JSON.stringify(output) }]);

describe("research Agent evidence boundary", () => {
  it.each([false, true])(
    "allows only retrieved citations with grounding: %s",
    async (grounded) => {
      vi.mocked(searchWeb).mockReturnValue(
        Effect.succeed({
          text: "Inspectable source evidence.",
          result: {
            error: undefined,
            sources: grounded
              ? []
              : [
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
      const evidence = {
        ...providerStep([
          ...groundingCall.content,
          { type: "text", text: "Evidence notes." },
          ...(grounded
            ? [
                {
                  type: "source" as const,
                  sourceType: "url" as const,
                  id: "official",
                  url,
                  title: "Official source",
                },
              ]
            : []),
        ]),
        ...(grounded
          ? {
              providerMetadata: {
                google: {
                  groundingMetadata: { webSearchQueries: ["official agents"] },
                },
              },
            }
          : {}),
      };
      const model = new MockLanguageModelV4({
        doGenerate: [searchCall, evidence, final],
      });
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
      const usageHandler = vi.fn();
      const { artifacts, publish } = recordProgress();
      const result = await runSpecialist((userId) =>
        runResearchAgent({
          ...specialistRequest,
          userId,
          task: `Verify ${url}`,
          sourceReferences: [source],
          toolCallId: "research",
          publish,
          usageHandler,
        })
      );
      expect(result.text).toContain("Verified finding.");
      expect(result.text).not.toContain("Invented finding.");
      expect(scrapeUrl).toHaveBeenCalledTimes(1);
      expect(usageHandler).toHaveBeenCalledTimes(3);
      expect(model.doGenerateCalls[0]?.toolChoice).toEqual({
        type: "tool",
        toolName: "webSearch",
      });
      expect(model.doGenerateCalls[1]?.toolChoice).toEqual({
        type: "required",
      });
      if (grounded) {
        expect(artifacts.at(-1)).toMatchObject({
          type: "data-web-search",
          data: { queries: ["official agents"], status: "done" },
        });
      } else {
        expect(artifacts).toEqual([]);
      }
    }
  );

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
        providerStep([
          ...groundingCall.content,
          { type: "text", text: "Unverified provider claim." },
        ]),
        final,
      ],
    });
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
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
            return Promise.resolve(groundingCall);
          }
          return Promise.resolve(
            providerStep([{ type: "text", text: "Invalid JSON" }])
          );
        },
      });
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
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
