import { createPrompt } from "@repo/ai/prompt/utils";

export function nakafaWebSearch() {
  return createPrompt({
    taskContext: `
      # webSearch Tool

      Use this tool to search the web for up-to-date information and as universal fallback for ANY topic when Nakafa content is insufficient.
      The tool uses Mendable's Firecrawl API under the hood.
      Use exactly the citation field for inline citations.
      Write inline citations before the period at the end of every sentence.
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
      - Use exactly the citation field for inline citations before the period at the end of every sentence
    `,

    detailedTaskInstructions: `
      ## Best Practices

      - Search the web for up-to-date information
      - Explain the content to the user in a way that is easy to understand
      - Use exactly the citation field for inline citations
      - Write inline citations before the period at the end of every sentence
    `,

    examples: `
      ## Examples of When to Use This Tool

      <example>
        User: what is the latest news about the stock market?
        Assistant: I'll find the latest news about the stock market for you.
        *Calls webSearch tool*
      </example>

      ## Examples of how to write inline citations

      <example>
        User: what is the latest news about the stock market?
        Assistant: The stock market is down today [source](https://www.google.com).
      </example>
    `,

    finalRequest: `
      ## Summary

      Use webSearch tool when the user asks to search the web for up-to-date information.
      Treat the content as a source of information to explain the content to the user.
      Write inline citations before the period at the end of every sentence.
    `,
  });
}
