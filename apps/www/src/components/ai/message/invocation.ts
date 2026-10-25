import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import { readOutcome } from "@repo/backend/client/nina/outcome";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import { type DynamicToolUIPart, getToolName, type ToolUIPart } from "ai";
import { Result, Schema } from "effect";

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
  const capability: typeof LearningCapabilityNameSchema.Type | "unknown" =
    Schema.is(LearningCapabilityNameSchema)(name) ? name : "unknown";
  return {
    artifacts,
    capability,
    state: readState(part, settled, output, capability),
  };
}

export type Invocation = ReturnType<typeof readInvocation>;

/**
 * The one fact the activity header reads. A finished run reads by the rule that
 * settles the outcome of a run (`readOutcome`), so a result stored before that
 * rule reads as a new one does, and the label cannot disagree with the
 * evidence under it.
 */
function readState(
  part: ToolUIPart | DynamicToolUIPart,
  settled: boolean,
  output: typeof CapabilityOutputSchema.Type | undefined,
  capability: string
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
  return readOutcome(output, capability);
}
