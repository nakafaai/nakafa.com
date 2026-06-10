import { formatTaxonomy } from "@repo/ai/agents/nakafa/format";
import { previewTaxonomy } from "@repo/ai/agents/nakafa/preview";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { NakafaAgentTaxonomyOptions } from "@repo/contents/_lib/agent/schema/taxonomy";
import type { Locale } from "@repo/contents/_types/content";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

interface Params {
  input: NakafaAgentTaxonomyOptions;
  locale: Locale;
  toolCallId: string;
  writer: Writer;
}

/** Reads Nakafa taxonomy and writes a bounded preview UI part. */
export const taxonomy = Effect.fn("nakafa.taxonomy")(function* ({
  input,
  locale,
  toolCallId,
  writer,
}: Params) {
  const dataInput = { ...input, locale };

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "taxonomy",
        input: dataInput,
        status: "loading",
      },
    })
  );

  const result = yield* Nakafa.taxonomy(dataInput.locale);

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "taxonomy",
        input: dataInput,
        status: "done",
        result: previewTaxonomy(result),
      },
    })
  );

  return formatTaxonomy(result);
});
