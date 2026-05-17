import { createPrompt } from "@repo/ai/prompt/utils";

export const nakafaWebSearch = createPrompt({
  taskContext: `
      # webSearch Tool

      Use this tool to search the web for up-to-date information and source content when Nakafa content is insufficient.
      The tool uses Mendable's Firecrawl API under the hood.
      Use returned titles and URLs as citation data for structured research findings.
      Keep citation data separate from finding prose.
    `,

  toolUsageGuidelines: `
      ## When to use this tool

      1. The user asks to search the web for up-to-date information
      2. You want to search the web for up-to-date information

      ## When NOT to use this tool

      Skip using this tool when:

      1. You have enough information from the Nakafa agent or current-page content
      2. The user asks to search the web for up-to-date information but you already have the information

      ## webSearch tool capabilities

      After searching the web, the webSearch allows you to:

      - Read source titles, URLs, descriptions, and relevant content
      - Use the returned source metadata as citation data
      - Keep source metadata separate from finding prose
    `,

  detailedTaskInstructions: `
      ## Best Practices

      - Preserve official-source, domain, URL, and recency constraints from the user task
      - Generate concise search-engine queries; do not pass the raw user prompt as a search query
      - Keep exact named products, APIs, libraries, features, versions, domains, URLs, source constraints, and document titles from the user task
      - Always set sourcePreference. Use primary when the task asks for source-owned, first-party, maintainer, vendor, standards-body, paper-author, primary, or official evidence in any language. Use any when broader credible sources are acceptable
      - For official documentation requests, include the exact named source and official domain in the queries
      - Do not broaden a specific documentation request into a generic industry trend search
      - Search the web for up-to-date information
      - Extract source-backed facts, data, and insights
      - Preserve source titles and URLs for the structured citations field

      ## CRITICAL: Temporal Context in Search Queries

      ALWAYS include date/time context in search queries:

      - For current events: use the actual current date/year from the agent context, plus words like "latest", "today", "current", or "recent"
      - For historical info: specific years or date ranges
      - For time-sensitive topics: use the actual current date/year from the agent context, plus words like "newest", "updated", or "current"
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
      ## Examples of When to Use This Tool

      <example>
        User: what is the latest news about the stock market?
        Assistant: I'll find the latest news about the stock market for you.
        *Calls webSearch tool*
      </example>

      ## Citation data

      Use returned source titles and URLs as citation data for structured findings.
    `,

  finalRequest: `
      ## Summary

      Use webSearch tool when the user asks to search the web for up-to-date information.
      Treat the content as source evidence for structured research findings.
      Keep source titles and URLs separate from finding prose.
    `,
});

export const nakafaScrape = createPrompt({
  taskContext: `
      # scrape Tool

      Use this tool to scrape a specific URL and return the content when search evidence is missing or weak.
      The tool uses Mendable's Firecrawl API under the hood.
    `,

  toolUsageGuidelines: `
      ## When to use this tool

      1. Search found a relevant URL but did not return enough content to answer confidently
      2. A selected search source needs direct inspection before you can answer

      ## When NOT to use this tool

      Skip using this tool when:

      1. You do not have a specific URL to inspect
      2. The URL is not related to the user's question

      ## scrape tool capabilities

      After scraping the URL, the scrape allows you to:

      - Explain the content to the user in a way that is easy to understand
    `,

  detailedTaskInstructions: `
      ## Best Practices

      - Scrape a selected URL when prior search content is too weak
      - Keep findings tied to the correct source when inspecting multiple selected URLs
      - Prefer primary documentation, standards, papers, and vendor pages over social/video/listicle pages
      - Explain the content to the user in a way that is easy to understand
      - If the content is not related to the user's question, tell the users that the content is not related to the user's question
    `,

  examples: `
      ## Examples of When to Use This Tool

      <example>
        User: Compare the current official docs for this framework.
        Assistant: The web search result needs direct source reading.
        *Calls scrape tool*
      </example>
    `,

  finalRequest: `
      ## Summary

      Use scrape tool when selected search evidence needs deeper source reading.
      Treat the content as a source of information to explain the content to the user.
    `,
});
