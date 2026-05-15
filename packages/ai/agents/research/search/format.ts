import type { WebSearchOutput } from "@repo/ai/agents/research/schema";
import dedent from "dedent";

/** Formats web search output as markdown for the research agent. */
export function formatWebSearchOutput(output: WebSearchOutput) {
  if (output.sources.length === 0) {
    return dedent(`
      # Web Search Results
      ${output.error ? `- Error: ${output.error}` : "- No usable source URLs or page content were returned."}

      Do not cite or describe source evidence from this result.
    `);
  }

  return dedent(`
    # Web Search Results

    ${output.sources
      .map(
        (source, index) => `
    ## Source ${index + 1}: ${source.title}
    - URL: ${source.url}
    - Citation: ${source.citation}
    - Description: ${source.description}

    ### Content
    ${source.content}`
      )
      .join("\n\n")}
  `);
}
