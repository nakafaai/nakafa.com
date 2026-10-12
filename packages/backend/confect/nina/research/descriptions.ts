import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";

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
        - versions and URLs.
        - source names.
        - document titles.
      - Preserve official-source, URL, and recency constraints from the user task.
      - Include the current date or year for time-sensitive queries.
      - When the task asks for results of given sites only, put their hostnames in the sites field and not in the queries.
      - Do not write a site: operator into a query: the search provider's news source did not honor it when measured on 12 October 2026.
      - When the task asks for an official, first-party, or primary source in any language, write queries that reach it: include the exact name of the source.
      - Do not broaden a specific documentation request into a generic industry trend search.
      - Avoid YouTube, social posts, and listicles unless requested or no primary source exists.
    `,
});
