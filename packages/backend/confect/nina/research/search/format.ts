import type { WebSearchOutput } from "@repo/backend/confect/nina/research/schema";
import dedent from "dedent";
import { Array as Arr, pipe } from "effect";

/** Formats web search output as markdown for the research agent. */
export function formatWebSearchOutput(output: WebSearchOutput) {
  if (output.sources.length === 0) {
    return formatNoSources(output);
  }

  return dedent(`
    # Web Search Results

    ${pipe(
      output.sources,
      Arr.map(
        (source, index) => `
    ## Source ${index + 1}: ${source.title}
    - URL: ${source.url}
    - Inline citation: ${source.citation}
    - Description: ${source.description}

    ${source.content ? `### Content\n    ${source.content}` : "- Page text: not read. Only the description above is known."}`
      ),
      Arr.join("\n\n")
    )}
  `);
}

/**
 * Says why a search returned no usable source: it failed, or it found nothing.
 * A search that was limited to sites says so, because the limit may be why it
 * found nothing: a site that the model writes from memory can be wrong or no
 * longer in use. Searching again without the limit is the reader's step, never
 * the code's, because the learner may have named those sites on purpose.
 */
function formatNoSources({ error, sites }: WebSearchOutput) {
  if (error) {
    return dedent(`
      # Web Search Results
      - Error: ${error}

      Do not cite or describe source evidence from this result.
    `);
  }

  if (sites) {
    return dedent(`
      # Web Search Results
      - The search was limited to these sites: ${Arr.join(sites, ", ")}.
      - No usable source URLs or page content were returned from them.
      - A site named from memory may be wrong or no longer in use.

      Do not cite or describe source evidence from this result.
      If the learner did not name these sites, research again without limiting the search to sites.
    `);
  }

  return dedent(`
    # Web Search Results
    - No usable source URLs or page content were returned.

    Do not cite or describe source evidence from this result.
  `);
}
