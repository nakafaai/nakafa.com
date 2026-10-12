import { purposes } from "@repo/backend/confect/gateway/purpose";

/**
 * How many model calls one math run may make, the ones that choose tools and
 * the one that writes the answer: as many steps of the specialist's step
 * deadline as its total deadline holds. A derivative and its value take three,
 * since the value needs the derivative first. The time the capability has is
 * shorter than the specialist's own deadline, so a run that keeps checking is
 * cut by its deadline in any case; this cap ends it sooner, with an answer.
 */
export const MATH_STEPS = Math.floor(
  purposes.specialist.timeout.totalMs / purposes.specialist.timeout.stepMs
);

/**
 * Shapes the steps of the math agent. The first step must call one
 * deterministic math tool. The last step may call none, so a run that went on
 * checking still ends with its answer, not with a tool call that nothing runs.
 *
 * Reference: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 */
export function prepareMathStep({ stepNumber }: { stepNumber: number }) {
  if (stepNumber === 0) {
    return { toolChoice: "required" } as const;
  }
  if (stepNumber === MATH_STEPS - 1) {
    return { toolChoice: "none" } as const;
  }
}
