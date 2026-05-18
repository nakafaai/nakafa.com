import { createPrompt } from "@repo/ai/prompt/utils";

export const nakafaWebSearch = createPrompt({
  taskContext: `
      # webSearch Tool

      Use this tool to search the web for up-to-date information and source content when Nakafa content is insufficient.
      The tool uses Mendable's Firecrawl API under the hood.
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

      - Search the web for source titles, URLs, descriptions, and relevant content.
      - Use the returned source metadata as citation data
      - Keep source titles and URLs separate from finding prose.
    `,

  detailedTaskInstructions: `
      ## Best Practices

      - Use returned titles and URLs as citation data for structured research findings
      - Preserve official-source, domain, URL, and recency constraints from the user task
      - Generate concise search-engine queries; do not pass the raw user prompt as a search query
      - Keep exact wording from the user task for:
        - named products, APIs, libraries, and features
        - versions, domains, and URLs
        - source constraints
        - document titles
      - Always set sourcePreference
      - Use primary when the task asks for:
        - source-owned evidence
        - first-party evidence
        - maintainer or vendor evidence
        - standards-body evidence
        - paper-author evidence
        - primary or official evidence in any language
      - Use any when broader credible sources are acceptable
      - For official documentation requests, include the exact named source and official domain in the queries
      - Do not broaden a specific documentation request into a generic industry trend search
      - Search the web for up-to-date information
      - Extract source-backed facts, data, and insights
      - Preserve source titles and URLs for the structured citations field

      ## Temporal Context in Search Queries

      Include date/time context in search queries:

      - For current events:
        - use the actual current date/year from the agent context
        - include words like "latest", "today", "current", or "recent"
      - For historical info: specific years or date ranges
      - For time-sensitive topics:
        - use the actual current date/year from the agent context
        - include words like "newest", "updated", or "current"
      - NO TEMPORAL ASSUMPTIONS: Never assume time periods - always be explicit about dates/years

      <example>
        Current date: May 15, 2026
        Queries: ["latest AI news 2026"]
      </example>

      <example>
        Current date: May 15, 2026
        Queries: ["current stock prices May 15 2026"]
      </example>

      <example>
        Current date: May 15, 2026
        Queries: ["recent developments 2026"]
      </example>
    `,

  examples: `
      ## Examples

      <example>
        User: what is the latest news about the stock market?
        *Calls webSearch tool*
      </example>

      ## Citation data

      Use returned source titles and URLs as citation data for structured findings.
    `,
});

export const nakafaScrape = createPrompt({
  taskContext: `
      # scrape Tool

      Use this tool to scrape a specific URL and return the content when search evidence is missing or weak.
      The tool uses Mendable's Firecrawl API under the hood.
    `,

  toolUsageGuidelines: `
      # Tool Usage Guidelines

      ## Use When

      Use when:
      - selected search evidence found a relevant URL but did not return enough content to answer confidently.
      - a selected search source needs direct inspection before synthesis.

      ## Skip When

      You do not have a specific related URL to inspect.

      ## Capabilities

      Read a selected source URL so findings can stay tied to direct source content.
    `,

  detailedTaskInstructions: `
      ## Best Practices

      - Scrape a selected URL when prior search content is too weak
      - Keep findings tied to the correct source when inspecting multiple selected URLs
      - Prefer primary documentation, standards, papers, and vendor pages over social/video/listicle pages
      - If the content is not related to the user's question, state that limitation
    `,

  examples: `
      ## Examples

      <example>
        User: Compare the current official docs for this framework.
        Assistant: The web search result needs direct source reading.
        *Calls scrape tool*
      </example>
    `,
});
