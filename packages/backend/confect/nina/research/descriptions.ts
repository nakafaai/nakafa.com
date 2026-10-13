import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";

/**
 * When a search may be limited to sites, written once. The search step's
 * instructions, the tool's description and the `sites` field all read these
 * words, so none of them can say another thing. A site the model names from
 * memory can be wrong or no longer in use, and a search limited to it then
 * finds nothing. The search step reads only the task that Nina writes, and
 * Nina writes a site into it only when the learner wrote it
 * (`research/capability.ts`), so the task, not the model's memory, decides
 * which site a search is limited to (docs/adr/0019-gateway.md, "Search
 * provider").
 */
export const webSearchSitesRule =
  "Put a site in the sites field only when the task asks for results from that site alone. A site or address that the task names for another reason, such as a page to read or a source to check against others, limits nothing: leave it out of the sites field. Put the hostname of a limiting site there, also when the task writes it as a URL, and not in the queries. A request for an official, recent, or primary source names no site by itself.";

export const nakafaWebSearch = createPrompt({
  taskContext: `
      # webSearch Tool

      Search the web for external, current, official, or source-owned evidence.
      Return source titles, URLs, descriptions, and relevant content for citation data.
    `,

  toolUsageGuidelines: `
      # Tool Usage Guidelines

      ## Use When

      The task needs evidence beyond Nakafa content:
      - up-to-date external information.
      - official documentation.
      - source-owned evidence.
      - current facts.
      - corroboration.

      ## Skip When

      You already have enough source-backed information from:
      - Nakafa content.
      - current-page content.
      - collected research evidence.

      ## Capabilities

      - Search source pages with inspectable content.
      - Use returned titles and URLs as citation data.
      - Keep source titles and URLs separate from finding prose.
    `,

  detailedTaskInstructions: `
      ## Best Practices

      - Use returned titles and URLs as citation data for structured research findings.
      - Generate concise search-engine queries; do not pass the raw user prompt as a search query.
      - Keep task-relevant user-provided strings for:
        - named products, APIs, libraries, and features.
        - versions and source names.
        - document titles.
        - the URL of a page that the query is about.
      - Preserve official-source and recency constraints from the user task.
      - Include the current date or year for time-sensitive queries.
      - ${webSearchSitesRule}
      - Do not write a site: operator into a query: the search provider's news source did not honor it when measured on 12 October 2026.
      - When the task asks for an official, first-party, or primary source in any language, write queries that reach it: include the exact name of the source.
      - Do not broaden a specific documentation request into a generic industry trend search.
      - Avoid YouTube, social posts, and listicles unless requested or no primary source exists.
    `,
});
