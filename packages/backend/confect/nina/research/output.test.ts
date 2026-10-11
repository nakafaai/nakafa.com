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

/** How the instruction Nina reads when research returns no source-backed finding begins. */
const noFindingStart =
  "Research returned no source-backed finding. Tell the learner what this attempt could not verify.";

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

  it("renders a scoped finding with its link, then the limitation as a bullet without one", () => {
    expect(
      formatResearchOutput({
        findings: [
          {
            text: "In 2029 the fee is 20.",
            citations: [
              { title: "Fee schedule", url: "https://example.org/fees" },
            ],
          },
        ],
        limitations: [
          "The collected sources state the 2029 fee and do not state the 2030 fee.",
        ],
      })
    ).toBe(
      "- In 2029 the fee is 20. [Fee schedule](https://example.org/fees)\n\n- The collected sources state the 2029 fee and do not state the 2030 fee."
    );
  });

  it("tells Nina to say what this attempt could not verify and to name a direct channel when no finding is source-backed", () => {
    const output = formatResearchOutput({
      findings: [],
      limitations: ["The requested page did not load."],
    });

    expect(output.startsWith(noFindingStart)).toBe(true);
    expect(output).toContain(
      "The limitations that follow say it; when none follow, it is the request itself."
    );
    expect(output).toContain("Name a direct channel they can check next.");
  });

  it("keeps every limitation after the no-finding instruction", () => {
    const [instruction, ...limitations] = formatResearchOutput({
      findings: [],
      limitations: ["The requested page did not load.", "The page was empty."],
    }).split("\n\n");

    expect(instruction?.startsWith(noFindingStart)).toBe(true);
    expect(limitations).toEqual([
      "- The requested page did not load.",
      "- The page was empty.",
    ]);
  });

  it("gives the no-finding instruction alone when no limitation follows", () => {
    const output = formatResearchOutput({ findings: [], limitations: [] });

    expect(output.startsWith(noFindingStart)).toBe(true);
    expect(output).not.toContain("\n");
  });

  it("never lets the no-finding instruction claim that anything is absent", () => {
    const output = formatResearchOutput({ findings: [], limitations: [] });

    expect(output).toContain(
      "Do not claim that anything is absent or does not exist."
    );
  });

  it("hands the collected sources over when synthesis is unavailable", () => {
    const output = formatUnsynthesizedEvidence(
      [
        "# Scrape Result\n- URL: https://nakafa.com/source",
        "# Web Search Results",
      ],
      ["https://example.org/unread"]
    );

    expect(output).toContain("Research synthesis was unavailable.");
    expect(output).toContain("say that the research is incomplete");
    expect(output).toContain(
      "# Scrape Result\n- URL: https://nakafa.com/source\n\n# Web Search Results\n\n# Sources That Could Not Be Read"
    );
    expect(output).toContain("- https://example.org/unread");
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
