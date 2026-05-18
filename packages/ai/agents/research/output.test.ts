import {
  addEligibleCitationUrl,
  addEligibleSourceUrls,
  filterResearchOutputCitations,
  normalizeResearchCitationUrl,
} from "@repo/ai/agents/research/citations";
import { formatResearchOutput } from "@repo/ai/agents/research/output";
import { describe, expect, it } from "vitest";

describe("formatResearchOutput", () => {
  it("renders citations inline from structured research output", () => {
    expect(
      formatResearchOutput({
        findings: [
          {
            text: "Agent workflows are becoming central to AI SDK usage.",
            citations: [
              {
                title: "ByteByteGo",
                url: "https://blog.bytebytego.com/p/whats-next-in-ai-five-trends-to-watch",
              },
              {
                title: "DevEssence",
                url: "https://devessence.com/blog/ai-in-software-development-2026",
              },
            ],
          },
        ],
        limitations: [],
        noEvidenceAnswer: "No direct evidence was available.",
      })
    ).toBe(
      "- Agent workflows are becoming central to AI SDK usage. [ByteByteGo](https://blog.bytebytego.com/p/whats-next-in-ai-five-trends-to-watch) [DevEssence](https://devessence.com/blog/ai-in-software-development-2026)"
    );
  });

  it("deduplicates repeated citation URLs inside one finding", () => {
    expect(
      formatResearchOutput({
        findings: [
          {
            text: "The same source should appear once.",
            citations: [
              {
                title: "AI SDK",
                url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
              },
              {
                title: "AI SDK Docs",
                url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
              },
            ],
          },
        ],
        limitations: [],
        noEvidenceAnswer: "No direct evidence was available.",
      })
    ).toBe(
      "- The same source should appear once. [AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/devtools)"
    );
  });

  it("renders limitations without a bibliography section", () => {
    const markdown = formatResearchOutput({
      findings: [
        {
          text: "DevTools documentation exists.",
          citations: [
            {
              title: "AI SDK",
              url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
            },
          ],
        },
      ],
      limitations: ["The retrieved source did not list every captured field."],
      noEvidenceAnswer: "No direct evidence was available.",
    });

    expect(markdown).toContain(
      "- DevTools documentation exists. [AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/devtools)"
    );
    expect(markdown).toContain(
      "- The retrieved source did not list every captured field."
    );
    expect(markdown).not.toContain("Sources");
  });

  it("keeps empty findings from becoming unsourced final claims", () => {
    const output = formatResearchOutput({
      findings: [],
      limitations: ["No source URLs were available."],
      noEvidenceAnswer: "I could not verify this from direct sources.",
    });

    expect(output).toBe("I could not verify this from direct sources.");
    expect(output).not.toContain("No source URLs were available.");
    expect(output).not.toContain("## Limitations");
  });

  it("drops generated findings whose citations are not eligible source evidence", () => {
    const eligibleUrls = new Set<string>();
    addEligibleCitationUrl(
      eligibleUrls,
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools"
    );

    const output = filterResearchOutputCitations(
      {
        findings: [
          {
            text: "DevTools are documented by the AI SDK.",
            citations: [
              {
                title: "AI SDK DevTools",
                url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools#local",
              },
            ],
          },
          {
            text: "Google redirects are source-owned references.",
            citations: [
              {
                title: "Google redirect",
                url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source",
              },
              {
                title: "Invalid",
                url: "notaurl",
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
        text: "DevTools are documented by the AI SDK.",
        citations: [
          {
            title: "AI SDK DevTools",
            url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools#local",
          },
        ],
      },
    ]);
    expect(output.limitations).toEqual([]);
  });

  it("drops only unsupported citations when a finding keeps source-backed evidence", () => {
    const eligibleUrls = new Set<string>();
    addEligibleCitationUrl(
      eligibleUrls,
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools"
    );

    const output = filterResearchOutputCitations(
      {
        findings: [
          {
            text: "DevTools are documented by the AI SDK.",
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
        text: "DevTools are documented by the AI SDK.",
        citations: [
          {
            title: "AI SDK DevTools",
            url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
          },
        ],
      },
    ]);
  });

  it("keeps findings unchanged when every citation is eligible", () => {
    const eligibleUrls = new Set<string>();
    addEligibleSourceUrls(eligibleUrls, [
      { url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools" },
    ]);
    addEligibleCitationUrl(eligibleUrls, "notaurl");

    const output = {
      findings: [
        {
          text: "DevTools has documentation.",
          citations: [
            {
              title: "AI SDK",
              url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
            },
          ],
        },
      ],
      limitations: [],
      noEvidenceAnswer: "No direct evidence was available.",
    };

    expect(filterResearchOutputCitations(output, eligibleUrls)).toBe(output);
    expect(normalizeResearchCitationUrl("notaurl")).toBeUndefined();
  });
});
