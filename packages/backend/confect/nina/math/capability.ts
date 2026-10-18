import { classify } from "@repo/backend/confect/gateway/classify";
import {
  defineCapability,
  failed,
} from "@repo/backend/confect/nina/capability/define";
import {
  formatSpecialistToolTask,
  mathToolInputSchema,
} from "@repo/backend/confect/nina/contract/tools";
import { runMathAgent } from "@repo/backend/confect/nina/math/agent";
import { ALLOWED } from "@repo/backend/confect/nina/policy/capability";
import { Effect } from "effect";

/** Math's part of the tool policy: where to use it and how to fill its input. */
const SECTION = `
## math

Use math for deterministic evidence across arithmetic, algebra, equations, inequalities, calculus, series, matrices, statistics, probability, geometry, and discrete math.
Use math to verify user-provided expressions, user-provided data, and math content retrieved from another evidence path.

Do not use math as the first or only source for practice sets: warmups, quizzes, tryout preparation, examples, hints, or review tasks.
Call Nakafa first, then use math only for deterministic verification of selected content.

Math input rules:
- Include the complete expression or data, target operation, variables, and learning goal when relevant.
- Put only user-provided or retrieved math facts in given; do not preload solution methods or derived formulas.
- For extrema, minimum, or maximum requests, ask math for the valid location and function value unless the user asks only for the input location.
- Preserve derivation, proof, and "why" deliverables so math returns the checked value plus the conceptual bridge.
- For multi-part requests, enumerate each calculation or verification.
- Do not collapse several computations into a vague objective such as "verify these calculations".
- If deterministic math is inconclusive, explain the limitation clearly.
`;

/** Verifies mathematical examples, expressions, answer keys and numeric claims by deterministic computation. */
export const mathCapability = defineCapability({
  continuation:
    "Verify fewer expressions per request to get the omitted results.",
  description:
    "Verify the exact mathematical examples, expressions, answer keys and numeric claims using deterministic computation. Retrieve educational practice content with Nakafa first.",
  guideline: {
    entry:
      "math: deterministic calculations, formulas, answer keys, and verification.",
    field:
      "math.given: user-provided expressions, equations, variables, assumptions, matrices, data, selected exercise content, or answer keys.",
    section: SECTION,
  },
  input: mathToolInputSchema,
  offered: () => ALLOWED,
  run: (input, { context, locale, publish, usageHandler, userId }) =>
    runMathAgent({
      userId,
      context,
      locale,
      task: formatSpecialistToolTask(input),
      publish,
      usageHandler,
    }).pipe(
      Effect.catchTag("MathGenerationError", (error) =>
        failed(
          { gateway: classify(error.cause) },
          "Deterministic math verification failed. State the limitation; do not claim an unverified calculation is correct."
        )
      )
    ),
});
