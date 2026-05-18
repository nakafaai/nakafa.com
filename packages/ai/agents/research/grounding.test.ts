import {
  addEligibleSourceUrls,
  filterResearchOutputCitations,
} from "@repo/ai/agents/research/citations";
import {
  createGroundingEvidence,
  createGroundingWebSearchData,
  hasSingleGroundingQuery,
} from "@repo/ai/agents/research/grounding";
import { describe, expect, it } from "vitest";

describe("research Google Search grounding", () => {
  it("drops query-only Google grounding when redirect sources are unusable", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {
        vertex: {
          groundingMetadata: {
            webSearchQueries: [
              ' "AI SDK DevTools"',
              ' "AI SDK DevTools"',
              '"DevTools"',
            ],
          },
        },
      },
      sources: [
        {
          sourceType: "url",
          title: "ai-sdk.dev",
          url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source",
        },
      ],
    });

    expect(data).toBeUndefined();
  });

  it("marks one-query grounding as safe for a query-scoped search row", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {
        vertex: {
          groundingMetadata: {
            webSearchQueries: ["official AI SDK DevTools documentation"],
          },
        },
      },
      sources: [
        {
          sourceType: "url",
          title: "AI SDK DevTools",
          url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        },
      ],
    });

    expect(data && hasSingleGroundingQuery(data)).toBe(true);
  });

  it("falls back to grounding chunks when source parts are unavailable", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {
        vertex: {},
        google: {
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  title: "Official Docs",
                  uri: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
                },
              },
              {},
            ],
          },
        },
      },
      sources: [
        {
          sourceType: "document",
        },
      ],
    });

    expect(data?.sources).toEqual([
      {
        citation:
          "[Official Docs](https://ai-sdk.dev/docs/ai-sdk-core/devtools)",
        content: "",
        description: "",
        title: "Official Docs",
        url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
      },
    ]);
    expect(data?.queries).toEqual([]);
  });

  it("reads Google metadata when no Vertex metadata is present", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {
        google: {
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  title: "Google Grounded Source",
                  uri: "https://example.com/google-grounded-source",
                },
              },
            ],
          },
        },
      },
      sources: [],
    });

    expect(data?.sources[0]?.title).toBe("Google Grounded Source");
  });

  it("drops opaque source labels when Google omits a public URL", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {
        vertex: {
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  uri: "opaque-grounding-source",
                },
              },
            ],
          },
        },
      },
      sources: "not source parts",
    });

    expect(data).toBeUndefined();
  });

  it("uses hostnames when Google omits source titles", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {
        vertex: {
          groundingMetadata: {
            webSearchQueries: null,
          },
        },
      },
      sources: [
        {
          sourceType: "url",
          url: "https://www.example.com/article",
        },
        {
          sourceType: "document",
          url: "https://ignored.example.com",
        },
      ],
    });

    expect(data?.queries).toEqual([]);
    expect(data?.sources).toEqual([
      {
        citation: "[example.com](https://www.example.com/article)",
        content: "",
        description: "",
        title: "example.com",
        url: "https://www.example.com/article",
      },
    ]);
  });

  it("builds web-search data from source parts without provider metadata", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {},
      sources: [
        {
          sourceType: "url",
          title: "Source Only",
          url: "https://example.com/source-only",
        },
      ],
    });

    expect(data).toEqual({
      provider: "google",
      queries: [],
      sources: [
        {
          citation: "[Source Only](https://example.com/source-only)",
          content: "",
          description: "",
          title: "Source Only",
          url: "https://example.com/source-only",
        },
      ],
      status: "done",
    });

    if (!data) {
      throw new Error("Expected source-only Google grounding data.");
    }

    expect(createGroundingEvidence(data)).not.toContain("Queries:");
  });

  it("does not create synthesis evidence without grounded sources", () => {
    expect(
      createGroundingEvidence({
        provider: "google",
        queries: ["official AI SDK DevTools documentation"],
        sources: [],
        status: "done",
      })
    ).toBeUndefined();
  });

  it("creates synthesis evidence from sanitized grounded sources", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {
        google: {
          groundingMetadata: {
            webSearchQueries: ["official AI SDK DevTools documentation"],
          },
        },
      },
      sources: [
        {
          sourceType: "url",
          title: "AI SDK DevTools",
          url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        },
        {
          sourceType: "url",
          title: "Google redirect",
          url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source",
        },
      ],
    });

    if (!data) {
      throw new Error("Expected direct Google grounding source data.");
    }

    const evidence = createGroundingEvidence(data);

    expect(evidence).toContain("# Google Search Grounding Sources");
    expect(evidence).toContain(
      'Queries: "official AI SDK DevTools documentation"'
    );
    expect(evidence).toContain("- AI SDK DevTools");
    expect(evidence).toContain(
      "URL: https://ai-sdk.dev/docs/ai-sdk-core/devtools"
    );
    expect(evidence).not.toContain("vertexaisearch.cloud.google.com");
  });

  it("allows only sanitized grounded URLs through the citation gate", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {},
      sources: [
        {
          sourceType: "url",
          title: "AI SDK DevTools",
          url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        },
        {
          sourceType: "url",
          title: "Google redirect",
          url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source",
        },
      ],
    });

    if (!data) {
      throw new Error("Expected direct Google grounding source data.");
    }

    const eligibleUrls = new Set<string>();
    addEligibleSourceUrls(eligibleUrls, data.sources);

    const output = filterResearchOutputCitations(
      {
        findings: [
          {
            text: "AI SDK DevTools has public documentation.",
            citations: [
              {
                title: "AI SDK DevTools",
                url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
              },
              {
                title: "Google redirect",
                url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source",
              },
            ],
          },
        ],
        limitations: [],
        noEvidenceAnswer: "I could not verify this from direct sources.",
      },
      eligibleUrls
    );

    expect(output.findings).toEqual([
      {
        text: "AI SDK DevTools has public documentation.",
        citations: [
          {
            title: "AI SDK DevTools",
            url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
          },
        ],
      },
    ]);
  });

  it("does not render query-only Google grounding as source evidence", () => {
    const data = createGroundingWebSearchData({
      providerMetadata: {
        google: {
          groundingMetadata: {
            webSearchQueries: ["official AI SDK DevTools documentation"],
          },
        },
      },
      sources: [],
    });

    expect(data).toBeUndefined();
  });

  it("returns nothing when no grounded web sources are available", () => {
    expect(
      createGroundingWebSearchData({
        providerMetadata: undefined,
        sources: [],
      })
    ).toBeUndefined();

    expect(
      createGroundingWebSearchData({
        providerMetadata: {},
        sources: [],
      })
    ).toBeUndefined();

    expect(
      createGroundingWebSearchData({
        providerMetadata: {
          vertex: {
            groundingMetadata: {
              groundingChunks: null,
            },
          },
        },
        sources: [],
      })
    ).toBeUndefined();
  });
});
