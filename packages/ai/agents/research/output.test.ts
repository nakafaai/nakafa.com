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
});
