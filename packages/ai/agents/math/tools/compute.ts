import { formatMathData } from "@repo/ai/agents/math/format";
import {
  readCoordinateArtifactId,
  readCoordinateProofAnchor,
} from "@repo/ai/agents/math/tools/identity";
import {
  invalidMathInputError,
  mathCheckUnavailableError,
  missingCoordinateArtifactDisplayError,
  readInvalidInputRecovery,
  readMathFailureRecovery,
  readMissingCoordinateArtifactDisplayRecovery,
} from "@repo/ai/agents/math/tools/recovery";
import {
  readArtifactDisplayCopy,
  readMathRequestInput,
} from "@repo/ai/agents/math/tools/request";
import { writeMathEvidencePart } from "@repo/ai/agents/math/tools/stream";
import type { MyUIMessage } from "@repo/ai/types/message";
import {
  deriveCoordinateArtifactsFromMathData,
  isCoordinateArtifactRequest,
} from "@repo/math/artifact/derive";
import type { LearningArtifact } from "@repo/math/schema/artifact/schema";
import type { MathData } from "@repo/math/schema/data";
import type { MathRequest } from "@repo/math/schema/request";
import { MathToolInputSchema } from "@repo/math/schema/tool-input";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either, ParseResult, Schema } from "effect";

/**
 * Formats schema validation errors for model-facing recovery decisions.
 */
function formatDecodeError(error: ParseResult.ParseError) {
  return ParseResult.TreeFormatter.formatErrorSync(error);
}

/**
 * Runs one deterministic math request and writes the math evidence data part.
 */
export const compute = Effect.fn("math.compute")(function* ({
  input,
  recordArtifacts,
  toolCallId,
  writer,
}: {
  readonly input: unknown;
  readonly recordArtifacts?: (
    artifacts: readonly LearningArtifact[]
  ) => Effect.Effect<void>;
  readonly toolCallId: string;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const decoded = yield* Schema.decodeUnknown(MathToolInputSchema)(input).pipe(
    Effect.either
  );

  if (Either.isLeft(decoded)) {
    const recovery = readInvalidInputRecovery(formatDecodeError(decoded.left));

    return [
      "# Checked Math Work",
      "- Status: error",
      `- Error code: ${invalidMathInputError}`,
      `- Recovery: ${recovery}`,
    ].join("\n");
  }

  const artifactCopy = readArtifactDisplayCopy(decoded.right);
  const request = {
    ...readMathRequestInput(decoded.right),
    kind: "math",
  } satisfies MathRequest;
  if (isCoordinateArtifactRequest(request) && !artifactCopy) {
    return [
      "# Checked Math Work",
      "- Status: error",
      `- Error code: ${missingCoordinateArtifactDisplayError}`,
      `- Recovery: ${readMissingCoordinateArtifactDisplayRecovery()}`,
    ].join("\n");
  }

  yield* writeMathEvidencePart({
    data: {
      input: request,
      kind: request.operation,
      status: "loading",
    },
    toolCallId,
    writer,
  });

  const checked = yield* MathService.compute(request).pipe(Effect.either);

  if (Either.isLeft(checked)) {
    const data = {
      error: mathCheckUnavailableError,
      input: request,
      kind: request.operation,
      status: "error",
    } satisfies MathData;

    yield* writeMathEvidencePart({ data, toolCallId, writer });

    return formatMathData(data, readMathFailureRecovery(checked.left.message));
  }

  const data = {
    input: request,
    kind: checked.right.operation,
    result: checked.right,
    status: checked.right.status,
    summary: checked.right.status,
  } satisfies MathData;

  const artifacts = yield* deriveCoordinateArtifactsFromMathData({
    artifactId: readCoordinateArtifactId(toolCallId),
    copy: artifactCopy,
    data,
    proofAnchor: readCoordinateProofAnchor(toolCallId),
  });
  yield* writeMathEvidencePart({ data, toolCallId, writer });
  if (artifacts.length > 0 && recordArtifacts) {
    yield* recordArtifacts(artifacts);
  }

  return formatMathData(data);
});
