import { createPrompt } from "@repo/ai/prompt/utils";

export function nakafaContent() {
  return createPrompt({
    taskContext: `
      # getContent Tool

      Use this tool to get the full content from Nakafa Platform. All content created by Nakafa Team.
      These content provides a string of the content.
    `,

    toolUsageGuidelines: `
      ## When to use this tool

      1. You are in a verified page or already get the verified slug from getSubjects or getArticles tool
      2. The user asks something related to the current page information

      ## When NOT to use this tool

      Skip using this tool when:

      1. You are not in a verified page or not get the verified slug from getSubjects or getArticles tool
      2. You do not know the current page information

      ## getContent tool capabilities

      After getting the full content, the getContent allows you to:

      - Explain the content to the user in a way that is easy to understand
    `,

    detailedTaskInstructions: `
      ## Best Practices

      - Get the full content from Nakafa Platform ONLY when you are in a verified page or already get the verified slug from getSubjects or getArticles tool
      - Explain the content to the user in a way that is easy to understand
      - If the content is not related to the user's question, tell the users that Nakafa does not have any content that match the user's question
    `,

    examples: `
      ## Examples of When to Use This Tool

      <example>
        User: What is this about? (user in a verified page)
        Assistant: Let me check the content for you.
        *Calls getContent tool*
      </example>
    `,

    finalRequest: `
      ## Summary

      Use getContent tool when you are in a verified page or already get the verified slug from getSubjects or getArticles tool and the user asks something related to the current page information.
      Treat the content as a source of information to explain the content to the user.
    `,
  });
}
