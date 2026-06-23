import type { LearningArtifactDisplayCopy } from "@repo/math/schema/artifact/copy";
import type { MathToolInput } from "@repo/math/schema/tool-input";

/**
 * Reads model-authored artifact copy without letting it affect CAS truth.
 */
export function readArtifactDisplayCopy(
  input: MathToolInput
): LearningArtifactDisplayCopy | undefined {
  return "display" in input ? input.display : undefined;
}

/**
 * Removes UI display copy before deterministic math evidence is persisted.
 */
export function readMathRequestInput(input: MathToolInput) {
  if (!("display" in input)) {
    return input;
  }

  const { display: _display, ...requestInput } = input;
  return requestInput;
}
