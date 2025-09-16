import { createPrompt } from "./utils";

export function nakafaCalculator() {
  return createPrompt({
    taskContext: `
      # calculator Tool

      Use this tool to calculate the user's question or our internal calculations using calculator.
      The tool uses Math.js under the hood to evaluate expressions. It will not work with algebraic variables like x, y, a, b.
      EVERYTHING should be calculated using this tool. DO NOT calculate manually. Even though it is simple arithmetic like 2+2.
      If user query is a story question or complex calculation, break down the question into smaller parts and calculate each part using this tool.
    `,

    toolUsageGuidelines: `
      ## When to use this tool

      1. The user asks to calculate something
      2. You want to calculate something using our internal calculations

      ## When NOT to use this tool

      Skip using this tool when:

      1. There is no mathematical expression in the user's question or our internal calculations
      2. There are algebraic variables in the user's question or our internal calculations

      ## calculator tool capabilities

      After calculating the user's question or our internal calculations, the calculator allows you to:

      - Know the result of the calculation
      - 100% correct result and to be sure that the calculation is correct
    `,

    detailedTaskInstructions: `
      ## Best Practices

      - EVERY calculation should be done using this tool, even though it is simple arithmetic like 2+2
      - Break down story questions or complex calculations into smaller parts and calculate each part using this tool
      - Explain every calculation step by step to the user
    `,

    examples: `
      ## Examples of When to Use This Tool

      <example>
        User: Calculate 2+2
        Assistant: Let me use the calculator tool to calculate 2+2
        *Calls calculator tool*
      </example>
    `,

    finalRequest: `
      ## Summary

      Use calculator tool when the user asks to calculate something or you want to calculate something using our internal calculations.
      Treat the result of the calculation as a source of information to tell the users the result of the calculation.
      Break down story questions or complex calculations into smaller parts and calculate each part using this tool.
    `,
  });
}
