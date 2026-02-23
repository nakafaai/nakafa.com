import { createPrompt } from "@repo/ai/prompt/utils";

export function nakafaArticles() {
  return createPrompt({
    taskContext: `
      # getArticles Tool

      Use this tool to get list of articles from Nakafa Platform. All articles created by Nakafa Team based on scientific research.
      Articles are not up to date, so it is not serve as current events.
      These articles provides the title, url, slug, and locale of the articles.
      Each element is unique and can be used for getContent tool by using the locale and slug for getting the content.
    `,

    toolUsageGuidelines: `
      ## When to use this tool

      1. You are in a page where the slug contains \`articles\`
      2. The user asks to find articles from Nakafa Platform  
      3. You want to use getContent tool, but do not have verified current page information (locale and slug)

      ## When NOT to use this tool

      Skip using this tool when:

      1. The user asks to find articles from Nakafa Platform but you already have the list of articles
      2. The user asks up to date or current events or scientific research that not related to Nakafa's articles category

      ## getArticles tool capabilities

      After getting the list of articles, the getArticles allows you to:

      - Use getContent tool by using \`locale\` and \`slug\` field from each element in the list
      - Tell helpful information about the articles to the user
    `,

    detailedTaskInstructions: `
      ## Best Practices

      - Get the list of articles from Nakafa Platform before using getContent tool or when user asks to find articles from Nakafa Platform
      - Tell the users about the articles using the title of the article and create a link to the article page using the \`url\` field from each element in the list
      - Use the getContent tool if you think the user wants to know more about some particular article from the list
      - If list returned is empty, tell the users that Nakafa does not have any articles that match the user's question
    `,

    examples: `
      ## Examples of When to Use This Tool

      <example>
        User: Do you have any articles?
        Assistant: Sure, I'll get the articles from Nakafa for you.
        *Calls getArticles tool*
      </example>
    `,

    finalRequest: `
      ## Summary

      Use getArticles tool when you are in a page where the slug contains \`articles\` and the user asks to find articles from Nakafa Platform.
      Treat the articles as a source of information to use the getContent tool for the user's question.
    `,
  });
}

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
