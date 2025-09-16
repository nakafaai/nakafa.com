import { createPrompt } from "@repo/ai/prompt/utils";

export function nakafaSubjects() {
  return createPrompt({
    taskContext: `
      # getSubjects Tool

      Use this tool to get list of subjects from Nakafa Platform. All subjects are about K-12 to university level created by Nakafa Team.
      These subjects provides the title, url, slug, and locale of the subjects.
      Each element is unique and can be used for getContent tool by using the locale and slug for getting the content.
    `,

    toolUsageGuidelines: `
      ## When to use this tool

      1. You are in a page where the slug contains \`subject\`
      2. The user asks to find subjects from Nakafa Platform  
      3. You want to use getContent tool, but do not have verified current page information (locale and slug)

      ## When NOT to use this tool

      Skip using this tool when:

      1. The user asks to find subjects from Nakafa Platform but you already have the list of subjects
      2. The user asks up to date or current events or scientific research that not related to Nakafa's subjects category, grade, or material

      ## getSubjects tool capabilities

      After getting the list of subjects, the getSubjects allows you to:

      - Use getContent tool by using \`locale\` and \`slug\` field from each element in the list
      - Tell helpful information about the subjects to the user
    `,

    detailedTaskInstructions: `
      ## Best Practices

      - Get the list of subjects from Nakafa Platform before using getContent tool or when user asks to find subjects from Nakafa Platform
      - Tell the users about the subjects using the title of the subject and create a link to the subject page using the \`url\` field from each element in the list
      - Use the getContent tool if you think the user wants to know more about some particular subject from the list
      - If list returned is empty, tell the users that Nakafa does not have any subjects that match the user's question
    `,

    examples: `
      ## Examples of When to Use This Tool

      <example>
        User: Do you have any subjects?
        Assistant: Sure, I'll get the subjects from Nakafa for you.
        *Calls getSubjects tool*
      </example>
    `,

    finalRequest: `
      ## Summary

      Use getSubjects tool when you are in a page where the slug contains \`subject\` and the user asks to find subjects from Nakafa Platform.
      Treat the subjects as a source of information to use the getContent tool for the user's question.
    `,
  });
}
