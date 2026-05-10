import type { MathRequest } from "@repo/math/schema";

/** Adds Nina's shared math source label to a tool-specific request. */
export function createMathRequest(input: Omit<MathRequest, "kind">) {
  return {
    ...input,
    kind: "math",
  } satisfies MathRequest;
}
