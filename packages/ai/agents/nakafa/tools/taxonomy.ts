import { formatTaxonomy } from "@repo/ai/agents/nakafa/format";
import { previewTaxonomy } from "@repo/ai/agents/nakafa/preview";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { NakafaAgentTaxonomyOptions } from "@repo/contents/_lib/agent/schemas";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

interface Params {
  input: NakafaAgentTaxonomyOptions;
  toolCallId: string;
  writer: Writer;
}

/** Reads Nakafa taxonomy and writes a bounded preview UI part. */
export const taxonomy = Effect.fn("nakafa.taxonomy")(function* ({
  input,
  toolCallId,
  writer,
}: Params) {
  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "taxonomy",
        input,
        status: "loading",
      },
    })
  );

  const result = yield* Nakafa.taxonomy(input.locale);

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "taxonomy",
        input,
        status: "done",
        result: previewTaxonomy(result),
      },
    })
  );

  return formatTaxonomy(result);
});
