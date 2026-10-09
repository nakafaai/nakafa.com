import { CapabilityOutputSchema } from "@repo/backend/confect/nina/capability/progress";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import { researchMaxSources } from "@repo/backend/confect/nina/research/schema";
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
  const unfinished =
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    (part.state === "output-available" && part.preliminary === true);
  return {
    artifacts,
    capability: Schema.is(LearningCapabilityNameSchema)(name)
      ? name
      : ("unknown" as const),
    failed:
      part.state === "output-error" ||
      output?.failure === "failed" ||
      output?.failure === "sourceLimit" ||
      (result !== undefined && Result.isFailure(result)),
    sourceLimit:
      output?.failure === "sourceLimit" ? researchMaxSources : undefined,
    denied: part.state === "output-denied" || output?.failure === "denied",
    failures: Arr.filter(
      artifacts,
      (artifact) => artifact.data.status === "error"
    ).length,
    running: unfinished && !settled,
    stopped: unfinished && settled,
  };
}

export type Invocation = ReturnType<typeof readInvocation>;
