import { createPrompt } from "@repo/ai/prompt/utils";

export function nakafaCreateDataset() {
  return createPrompt({
    taskContext: `
      # createDataset Tool

      Use this tool to create a new dataset by researching entities from the web.
      The system will automatically generate appropriate column schema, discover entities, research each field with deep multi-source verification, and provide citations with confidence scores.
      All data is extracted with transparency showing sources, confidence levels, and reasoning.
    `,

    toolUsageGuidelines: `
      ## When to use this tool

      1. User wants to research companies, organizations, people, or any entities
      2. No dataset exists yet for the current chat
      3. User describes what data they want to collect

      ## When NOT to use this tool

      Skip using this tool when:

      1. A dataset already exists for this chat (use other tools for modifications)
      2. User is just asking questions about existing data
      3. User wants to export or visualize existing dataset

      ## createDataset tool capabilities

      After creating the dataset, the system will:

      - Automatically generate appropriate columns based on the query
      - Discover entities from the web (companies, organizations, etc.)
      - Research each field with multiple sources
      - Extract structured data with citations
      - Stream results in real-time to the user
      - Provide confidence scores for each data point
    `,

    detailedTaskInstructions: `
      ## CRITICAL: DO NOT Generate Data Yourself

      NEVER create, generate, or display any data in your response. The workflow will handle all data creation automatically.

      ## Response Guidelines

      After calling the tool, provide ONLY a brief acknowledgment. Nothing more.

      - ✅ CORRECT: "I'll create a dataset for 10 German business analysis companies."
      - ❌ WRONG: Showing tables, data, results, or detailed information
      - ❌ WRONG: Creating fake data or examples
      - ❌ WRONG: Long explanations about what will happen

      ## Parameter Extraction

      - Extract the research goal clearly from user's prompt
      - If user doesn't specify number of entities, use default of 10 rows
      - Call the tool immediately
      - Give one brief sentence acknowledging the request
    `,

    examples: `
      ## Response Examples

      <example>
        User: Research 50 European SaaS companies
        Assistant: I'll create a dataset for 50 European SaaS companies.
        *Calls createDataset tool*
        *STOPS - NO additional text, tables, or data*
      </example>

      <example>
        User: I need data on YC startups with their funding
        Assistant: I'll create a dataset for YC startups with funding information.
        *Calls createDataset tool*
        *STOPS - workflow handles everything*
      </example>

      <example>
        User: Find German companies in business analysis
        Assistant: I'll create a dataset for 10 German business analysis companies.
        *Calls createDataset tool with default 10 rows*
        *STOPS immediately*
      </example>
    `,

    finalRequest: `
      ## Summary

      1. Call createDataset tool when user wants to research entities
      2. Extract query and targetRows (default 10 if not specified)
      3. Respond with ONE brief sentence acknowledging the request
      4. STOP immediately - do not generate any data, tables, or additional information
      5. The workflow will handle all data creation and display

      Remember: You are NOT creating the data. You are only triggering the workflow that will create it.
    `,
  });
}
