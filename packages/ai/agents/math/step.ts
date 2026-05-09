/**
 * Forces the first math-agent step to call one deterministic math tool.
 *
 * Reference: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 */
export function prepareMathStep({ stepNumber }: { stepNumber: number }) {
  if (stepNumber !== 0) {
    return;
  }

  return {
    toolChoice: "required",
  } as const;
}
