import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import { type DynamicToolUIPart, getToolName, type ToolUIPart } from "ai";
import { Array as Arr, Result, Schema } from "effect";

/**
 * Validates one native Agent invocation at its rendering seam and never infers
 * failure from prose. Server pages call it too, so activity rows receive plain
 * data instead of loading the SDK and capability schemas in the browser.
 */
export function readInvocation(
  part: ToolUIPart | DynamicToolUIPart,
  settled: boolean
) {
  const name = getToolName(part);
  const result =
    part.state === "output-available"
      ? Schema.decodeUnknownResult(CapabilityOutputSchema)(part.output)
      : undefined;
  const output =
    result && Result.isSuccess(result) ? result.success : undefined;
  const artifacts = output?.artifacts ?? [];
  return {
    artifacts,
    capability: Schema.is(LearningCapabilityNameSchema)(name)
      ? name
      : ("unknown" as const),
    failures: Arr.filter(
      artifacts,
      (artifact) => artifact.data.status === "error"
    ).length,
    state: readState(part, settled, output),
  };
}

export type Invocation = ReturnType<typeof readInvocation>;

/**
 * The one fact the activity header reads. A finished run takes the outcome the
 * capability stored, so the label cannot disagree with the evidence under it.
 */
function readState(
  part: ToolUIPart | DynamicToolUIPart,
  settled: boolean,
  output: typeof CapabilityOutputSchema.Type | undefined
) {
  if (part.state === "output-denied") {
    return "denied" as const;
  }
  if (part.state === "output-error") {
    return "failed" as const;
  }
  if (part.state !== "output-available" || part.preliminary === true) {
    return settled ? ("stopped" as const) : ("running" as const);
  }
  if (!output) {
    return "failed" as const;
  }
  return output.outcome ?? ("done" as const);
}
