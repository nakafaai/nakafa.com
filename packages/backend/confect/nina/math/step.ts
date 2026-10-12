import { purposes } from "@repo/backend/confect/gateway/purpose";

/**
 * How many steps one math run may take, the ones that choose tools and the one
 * that writes the answer: as many steps of the specialist's step deadline as
 * its total deadline holds. A derivative and its value take three, since the
 * value needs the derivative first. A step is one call of the specialist's
 * model. The repair of a tool call that came out invalid is one more call
 * inside its step and is not counted, so this bounds the steps and the time
 * the capability has bounds every call. That time is shorter than the
 * specialist's own deadline, so a run that keeps checking is cut by its
 * deadline in any case; this cap ends it sooner, with an answer.
 */
export const MATH_STEPS = Math.floor(
  purposes.specialist.timeout.totalMs / purposes.specialist.timeout.stepMs
);

/**
 * Shapes the steps of the math agent. The first step must call one
 * deterministic math tool. The last step may call none, so a run that went on
 * checking still ends with its answer, not with a tool call that nothing runs.
 * Reaching the last step is no shortfall, since a run that has checked all it
 * needs writes its answer there too: the prompt asks the model to name any
 * calculation it did not check, and a provider that still calls a tool in the
 * last step is cut by the step cap and reported as partial.
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
