import type { MyUIMessage } from "@repo/ai/types/message";
import { isCoordinateArtifactRequest } from "@repo/math/artifact/derive";
import type { MathData } from "@repo/math/schema/data";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/**
 * Writes user-visible math evidence unless a 3D artifact owns the visualization.
 */
export const writeMathEvidencePart = Effect.fn("math.evidence.write")(
  function* ({
    data,
    toolCallId,
    writer,
  }: {
    readonly data: MathData;
    readonly toolCallId: string;
    readonly writer: UIMessageStreamWriter<MyUIMessage>;
  }) {
    if (isCoordinateArtifactRequest(data.input)) {
      return;
    }

    yield* Effect.sync(() =>
      writer.write({
        data,
        id: toolCallId,
        type: "data-math",
      })
    );
  }
);
