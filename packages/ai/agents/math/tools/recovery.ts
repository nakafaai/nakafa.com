import { createPrompt } from "@repo/ai/prompt/utils";

/** Stable error code returned when math tool arguments fail schema decoding. */
export const invalidMathInputError = "invalid_math_input";

/** Stable error code returned when deterministic math checking is unavailable. */
export const mathCheckUnavailableError = "math_check_unavailable";

/** Stable error code returned when coordinate artifacts lack LLM display copy. */
export const missingCoordinateArtifactDisplayError =
  "missing_coordinate_artifact_display";

/**
 * Gives the model actionable recovery guidance without exposing raw failures.
 */
export function readMathFailureRecovery(message: string) {
  if (message.includes("Variable is required when multiple symbols")) {
    return createPrompt({
      taskContext: `
        Retry the same operation with the explicit variable from the user's original math notation.
      `,
      detailedTaskInstructions: `
        If no variable is clear, ask the user which variable to use.
      `,
    });
  }

  return createPrompt({
    taskContext: `
      Do not present this result as checked.
    `,
    detailedTaskInstructions: `
      - Compare this failed input with the original task before answering.
      - Retry the same operation if the task gives omitted variables, assumptions, domains, bounds, parameters, matrices, vectors, or data.
      - Otherwise ask for the missing math data.
    `,
  });
}

/**
 * Gives the model a concrete retry path for invalid tool arguments.
 */
export function readInvalidInputRecovery(message: string) {
  if (message.includes("Expected bounded system solves")) {
    return createPrompt({
      taskContext: `
        Retry the same equation solve.
      `,
      detailedTaskInstructions: `
        - Keep the same expressions, operation, bounds, and inclusivity fields from the failed input.
        - Set variable to the bounded variable from the user's domain restriction.
        - Set variables to the unknowns that should be solved.
      `,
    });
  }

  if (message.includes("Expected every bounded-system expression")) {
    return createPrompt({
      taskContext: `
        Retry the same bounded system solve.
      `,
      detailedTaskInstructions: `
        - Keep symbolic parameters out of variables.
        - Set variables to the unknowns that should be solved.
        - Every expression must involve at least one selected unknown.
      `,
    });
  }

  return "Ask the user for the exact missing expression or data in their language.";
}

/**
 * Gives the model the exact retry contract for artifact title/description copy.
 */
export function readMissingCoordinateArtifactDisplayRecovery() {
  return createPrompt({
    taskContext: `
      Retry the same geometry operation with display.title and display.description.
    `,
    detailedTaskInstructions: `
      - Keep the same operation and point inputs from the failed coordinate request.
      - Write display copy in the user's language.
      - Make the title concise and specific to the geometry being rendered.
      - Make the description pedagogical and grounded in the verified geometry.
      - Use inline math delimiters only when they clarify the artifact.
    `,
  });
}
