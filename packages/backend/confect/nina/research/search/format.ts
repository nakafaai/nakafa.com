import type { WebSearchOutput } from "@repo/backend/confect/nina/research/schema";
import dedent from "dedent";
import { Array as Arr, pipe } from "effect";

/** The title of every web search result the research agent reads. */
const heading = "# Web Search Results";

/** Closes a result that holds no source: nothing in it may be cited. */
const noEvidence = "Do not cite or describe source evidence from this result.";

/** Formats web search output as markdown for the research agent. */
export function formatWebSearchOutput(output: WebSearchOutput) {
  if (output.sources.length === 0) {
    return formatNoSources(output);
  }

  return dedent(`
    ${heading}

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
 * What Nina is told when a search limited to sites returned no source, whatever
 * else the run answers from: the limit, which may be why it found nothing, as a
 * list of one text that joins the answer. The list is empty for an open search,
 * a search that failed, and a search that returned any source, also one that no
 * citation may name, because the limit is not why nothing was found then.
 */
export function formatSearchLimit(output: WebSearchOutput) {
  if (output.error || !output.sites || output.sources.length > 0) {
    return [];
  }

  return [formatNoSources(output)];
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
      ${heading}
      - Error: ${error}

      ${noEvidence}
    `);
  }

  if (sites) {
    return dedent(`
      ${heading}
      - The search was limited to these sites: ${Arr.join(sites, ", ")}.
      - No usable source URLs or page content were returned from them.
      - A site named from memory may be wrong or no longer in use.

      ${noEvidence}
      If the learner did not name these sites, research again without limiting the search to sites.
    `);
  }

  return dedent(`
    ${heading}
    - No usable source URLs or page content were returned.

    ${noEvidence}
  `);
}
