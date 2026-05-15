import { createPrompt } from "@repo/ai/prompt/utils";

export const nakafaWebSearch = createPrompt({
  taskContext: `
      # webSearch Tool

      Use this tool to search the web for up-to-date information and source content when Nakafa content is insufficient.
      The tool uses Mendable's Firecrawl API under the hood.
      Use exactly the citation field for inline citations as LINKS (not images).
      Write inline citations before the period at the end of every sentence.
      CRITICAL: Always use link markdown syntax [text](url), NEVER use image markdown syntax ![alt](url).
      NEVER write numeric citation markers like [1] or [4, 21, 23].
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

      - Explain the content to the user in a way that is easy to understand
      - Use exactly the citation field for inline citations as LINKS before the period at the end of every sentence
      - IMPORTANT: Citations must be links [text](url), NOT images ![alt](url)
      - IMPORTANT: Citations must not be numeric markers like [1] or [4, 21, 23]
    `,

  detailedTaskInstructions: `
      ## Best Practices

      - Preserve official-source, domain, URL, and recency constraints from the user task
      - Generate concise search-engine queries; do not pass the raw user prompt as a search query
      - For official documentation requests, include the exact named source and official domain in the queries
      - Do not broaden a specific documentation request into a generic industry trend search
      - Search the web for up-to-date information
      - Explain the content to the user in a way that is easy to understand
      - Use exactly the citation field for inline citations as LINKS (not images)
      - Write inline citations before the period at the end of every sentence
      - Always use link syntax [text](url), NEVER image syntax ![alt](url)
      - Never use numeric citation markers like [1] or [4, 21, 23]

      ## CRITICAL: Temporal Context in Search Queries

      ALWAYS include date/time context in search queries:

      - For current events: "latest", "current year", "today", "current", "recent"
      - For historical info: specific years or date ranges
      - For time-sensitive topics: "newest", "updated", "current year"
      - NO TEMPORAL ASSUMPTIONS: Never assume time periods - always be explicit about dates/years

      <example>
        Queries: ["latest AI news current year"]
      </example>

      <example>
        Queries: ["current stock prices today"]
      </example>

      <example>
        Queries: ["recent developments in current year"]
      </example>
    `,

  examples: `
      ## Examples of When to Use This Tool

      <example>
        User: what is the latest news about the stock market?
        Assistant: I'll find the latest news about the stock market for you.
        *Calls webSearch tool*
      </example>

      ## Examples of how to write inline citations

      <good-example>
        DO write citations as links [text](url):
        Assistant: The stock market is down today [source](https://www.google.com).
      </good-example>

      <bad-example>
        DON'T write citations as images ![alt](url):
        Assistant: The stock market is down today ![source](https://www.google.com).
      </bad-example>
    `,

  finalRequest: `
      ## Summary

      Use webSearch tool when the user asks to search the web for up-to-date information.
      Treat the content as a source of information to explain the content to the user.
      Write inline citations as LINKS before the period at the end of every sentence.
      NEVER use image markdown syntax ![alt](url) for citations - always use link syntax [text](url).
      NEVER use numeric citation markers like [1] or [4, 21, 23].
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
