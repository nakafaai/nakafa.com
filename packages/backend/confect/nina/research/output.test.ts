import { describe, expect, it } from "@effect/vitest";
import {
  addEligibleCitationUrl,
  addEligibleSourceUrls,
  filterResearchOutputCitations,
  normalizeResearchCitationUrl,
} from "@repo/backend/confect/nina/research/citations";
import {
  formatResearchOutput,
  formatUnsynthesizedEvidence,
} from "@repo/backend/confect/nina/research/output";
import { MutableHashSet } from "effect";

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
    });

    expect(markdown).toContain(
      "- DevTools documentation exists. [AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/devtools)"
    );
    expect(markdown).toContain(
      "- The retrieved source did not list every captured field."
    );
    expect(markdown).not.toContain("Sources");
  });

  it("tells Nina what to say when no finding is source-backed, and keeps the limitations", () => {
    const output = formatResearchOutput({
      findings: [],
      limitations: ["The requested page did not load."],
    });

    expect(output).toBe(
      "Research returned no source-backed finding. Tell the learner that this attempt could not verify the request from direct sources, and name a direct channel they can check next. Do not claim that anything is absent or does not exist.\n\n- The requested page did not load."
    );
  });

  it("hands the collected sources over when synthesis is unavailable", () => {
    const output = formatUnsynthesizedEvidence([
      "# Scrape Result\n- URL: https://nakafa.com/source",
      "# Web Search Results",
    ]);

    expect(output).toContain("Research synthesis was unavailable.");
    expect(output).toContain("say that the research is incomplete");
    expect(output).toContain(
      "# Scrape Result\n- URL: https://nakafa.com/source\n\n# Web Search Results"
    );
  });

  it("drops generated findings whose citations are not eligible source evidence", () => {
    const eligibleUrls = MutableHashSet.empty<string>();
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
            text: "Unretrieved sources are not evidence.",
            citations: [
              {
                title: "Unretrieved source",
                url: "https://example.com/unretrieved",
              },
              {
                title: "Invalid",
                url: "notaurl",
              },
            ],
          },
        ],
        limitations: [],
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
    const eligibleUrls = MutableHashSet.empty<string>();
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
                title: "Unretrieved source",
                url: "https://example.com/unretrieved",
              },
            ],
          },
        ],
        limitations: [],
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
    const eligibleUrls = MutableHashSet.empty<string>();
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
    };

    expect(filterResearchOutputCitations(output, eligibleUrls)).toBe(output);
    expect(normalizeResearchCitationUrl("notaurl")).toBeUndefined();
  });
});
