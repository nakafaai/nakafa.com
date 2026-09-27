import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import { formatTaxonomy } from "@repo/backend/confect/nina/nakafa/format";
import { previewTaxonomy } from "@repo/backend/confect/nina/nakafa/preview";
import type { NakafaAgentTaxonomyOptions } from "@repo/contents/agent/schema/taxonomy";
import type { Locale } from "@repo/contents/content";
import { Effect } from "effect";

/** Reads Nakafa taxonomy and writes a bounded preview UI part. */
export const taxonomy = Effect.fn("nakafa.taxonomy")(function* ({
  input,
  locale,
  toolCallId,
  publish,
}: {
  readonly input: NakafaAgentTaxonomyOptions;
  readonly locale: Locale;
  readonly toolCallId: string;
  readonly publish: CapabilityProgress;
}) {
  const dataInput = { ...input, locale };
  yield* publish({
    id: toolCallId,
    type: "data-nakafa",
    data: {
      kind: "taxonomy",
      input: dataInput,
      status: "loading",
    },
  });
  const result = yield* getNakafaTaxonomy(dataInput.locale);
  yield* publish({
    id: toolCallId,
    type: "data-nakafa",
    data: {
      kind: "taxonomy",
      input: dataInput,
      status: "done",
      result: previewTaxonomy(result),
    },
  });
  return formatTaxonomy(result);
});
