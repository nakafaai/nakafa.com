import { createPrompt } from "@repo/ai/prompt/utils";

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
