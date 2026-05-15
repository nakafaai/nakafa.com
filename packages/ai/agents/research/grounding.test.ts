import { createGroundingWebSearchData } from "@repo/ai/agents/research/grounding";
import { describe, expect, it } from "vitest";

describe("research Google Search grounding", () => {
  it("builds web-search data from Vertex grounding sources", () => {
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

    expect(data).toEqual({
      queries: ["AI SDK DevTools", "DevTools"],
      sources: [
        {
          citation:
            "[ai-sdk.dev](https://vertexaisearch.cloud.google.com/grounding-api-redirect/source)",
          content: "",
          description: "",
          title: "ai-sdk.dev",
          url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source",
        },
      ],
      status: "done",
    });
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

  it("keeps opaque source labels when Google omits a parseable URL", () => {
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

    expect(data?.sources).toEqual([
      {
        citation: "[opaque-grounding-source](opaque-grounding-source)",
        content: "",
        description: "",
        title: "opaque-grounding-source",
        url: "opaque-grounding-source",
      },
    ]);
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
  });

  it("keeps Google Search activity visible when only search queries are returned", () => {
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

    expect(data).toEqual({
      queries: ["official AI SDK DevTools documentation"],
      sources: [],
      status: "done",
    });
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
