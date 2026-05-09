import type { MathData } from "@repo/math/schema";
import dedent from "dedent";

/** Formats deterministic math evidence as model-readable markdown. */
export function formatMathData(data: MathData) {
  if (data.status === "loading") {
    return "Math evidence is loading.";
  }

  if (data.status === "error") {
    return dedent(`
      # Math Evidence

      - Status: error
      - Kind: ${data.kind}
      - Error: ${data.error}
    `);
  }

  if (data.kind === "evaluate") {
    return dedent(`
      # Math Evidence

      - Status: verified
      - Kind: evaluate
      - Input: ${data.result.input.expression}
      - Result: ${data.result.output.value}
    `);
  }

  if (data.kind === "simplify") {
    return dedent(`
      # Math Evidence

      - Status: verified
      - Kind: simplify
      - Input: ${data.result.input.expression}
      - Result: ${data.result.output.expression}
    `);
  }

  if (data.kind === "differentiate") {
    return dedent(`
      # Math Evidence

      - Status: verified
      - Kind: differentiate
      - Variable: ${data.result.variable}
      - Input: ${data.result.input.expression}
      - Result: ${data.result.output.expression}
    `);
  }

  return dedent(`
    # Math Evidence

    - Status: ${data.status}
    - Kind: compare
    - Left: ${data.result.left.expression}
    - Right: ${data.result.right.expression}
    - Reason: ${data.result.reason}
  `);
}
