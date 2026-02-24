import { createPrompt } from "@repo/ai/prompt/utils";

export function nakafaWebSearch() {
  return createPrompt({
    taskContext: `
      # webSearch Tool

      Use this tool to search the web for up-to-date information and as universal fallback for ANY topic when Nakafa content is insufficient.
      The tool uses Mendable's Firecrawl API under the hood.
      Use exactly the citation field for inline citations as LINKS (not images).
      Write inline citations before the period at the end of every sentence.
      CRITICAL: Always use link markdown syntax [text](url), NEVER use image markdown syntax ![alt](url).
    `,

    toolUsageGuidelines: `
      ## When to use this tool

      1. The user asks to search the web for up-to-date information
      2. You want to search the web for up-to-date information

      ## When NOT to use this tool

      Skip using this tool when:

      1. You have enough information from Nakafa content, typically from getContent tool
      2. The user asks to search the web for up-to-date information but you already have the information

      ## webSearch tool capabilities

      After searching the web, the webSearch allows you to:

      - Explain the content to the user in a way that is easy to understand
      - Use exactly the citation field for inline citations as LINKS before the period at the end of every sentence
      - IMPORTANT: Citations must be links [text](url), NOT images ![alt](url)
    `,

    detailedTaskInstructions: `
      ## Best Practices

      - Search the web for up-to-date information
      - Explain the content to the user in a way that is easy to understand
      - Use exactly the citation field for inline citations as LINKS (not images)
      - Write inline citations before the period at the end of every sentence
      - Always use link syntax [text](url), NEVER image syntax ![alt](url)

      ## CRITICAL: Temporal Context in Search Queries

      ALWAYS include date/time context in search queries:

      - For current events: "latest", "${new Date().getFullYear()}", "today", "current", "recent"
      - For historical info: specific years or date ranges
      - For time-sensitive topics: "newest", "updated", "${new Date().getFullYear()}"
      - NO TEMPORAL ASSUMPTIONS: Never assume time periods - always be explicit about dates/years

      <example>
        Query: "latest AI news ${new Date().getFullYear()}"
      </example>

      <example>
        Query: "current stock prices today"
      </example>

      <example>
        Query: "recent developments in ${new Date().getFullYear()}"
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
    `,
  });
}

export function nakafaScrape() {
  return createPrompt({
    taskContext: `
      # scrape Tool

      Use this tool to scrape a URL and return the content. Use this for specific URLs to get the content of the url.
      The tool uses Mendable's Firecrawl API under the hood.
    `,

    toolUsageGuidelines: `
      ## When to use this tool

      1. The user asks to scrape a URL or asks you to explain the content of the url
      2. You want to scrape a URL to get the content of the url

      ## When NOT to use this tool

      Skip using this tool when:

      1. The user asks to scrape a URL or asks you to explain the content of the url but you do not have the URL
      2. The URL is not related to the user's question

      ## scrape tool capabilities

      After scraping the URL, the scrape allows you to:

      - Explain the content to the user in a way that is easy to understand
    `,

    detailedTaskInstructions: `
      ## Best Practices

      - Scrape the URL to get the content of the url
      - Explain the content to the user in a way that is easy to understand
      - If the content is not related to the user's question, tell the users that the content is not related to the user's question
    `,

    examples: `
      ## Examples of When to Use This Tool

      <example>
        User: What is this about? (SOME URL https://...)
        Assistant: Let me check the content for you.
        *Calls scrape tool*
      </example>
    `,

    finalRequest: `
      ## Summary

      Use scrape tool when the user asks to scrape a URL or asks you to explain the content of the url.
      Treat the content as a source of information to explain the content to the user.
    `,
  });
}
