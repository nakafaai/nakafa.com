import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import { NakafaDataSchema } from "@repo/backend/confect/nina/contract/data";
import { formatQuran } from "@repo/backend/confect/nina/nakafa/format";
import { previewQuran } from "@repo/backend/confect/nina/nakafa/preview";
import { NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES } from "@repo/contents/agent/constants";
import type { NakafaAgentQuranReferenceOptions } from "@repo/contents/agent/schema/quran/input";
import type { Locale } from "@repo/contents/content";
import { Effect, Result, Schema } from "effect";

const invalidRangeMessage = "Invalid Quran verse range.";
const oversizedRangeMessage = "Quran reference range is too large.";
/** Reads a bounded Nakafa Quran reference and writes a preview UI part. */
export const quran = Effect.fn("nakafa.quran")(function* ({
  input,
  locale,
  toolCallId,
  publish,
}: {
  readonly input: NakafaAgentQuranReferenceOptions;
  readonly locale: Locale;
  readonly toolCallId: string;
  readonly publish: CapabilityProgress;
}) {
  const dataInput = normalizeQuranInput(input, locale);
  yield* publish({
    id: toolCallId,
    type: "data-nakafa",
    data: {
      kind: "quran",
      input: dataInput,
      status: "loading",
    },
  });
  const fromVerse = dataInput.from_verse;
  const toVerse = dataInput.to_verse ?? fromVerse;
  const requestedVerseCount = toVerse - fromVerse + 1;
  if (toVerse < fromVerse) {
    yield* publish({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "quran",
        input: dataInput,
        status: "error",
        error: invalidRangeMessage,
      },
    });
    return invalidRangeMessage;
  }
  if (requestedVerseCount > NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES) {
    yield* publish({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "quran",
        input: dataInput,
        status: "error",
        error: oversizedRangeMessage,
      },
    });
    return oversizedRangeMessage;
  }
  const result = yield* Effect.result(getNakafaQuranReference(dataInput));
  if (Result.isFailure(result)) {
    yield* publish({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "quran",
        input: dataInput,
        status: "error",
        error: result.failure.message,
      },
    });
    return result.failure.message;
  }
  const value = result.success;
  const done = yield* Schema.decodeUnknownEffect(NakafaDataSchema)({
    kind: "quran",
    input: dataInput,
    status: "done",
    result: previewQuran(value),
  });
  yield* publish({
    id: toolCallId,
    type: "data-nakafa",
    data: done,
  });
  return formatQuran(value);
});
/** Applies Quran input defaults before writing persistent UI data. */
function normalizeQuranInput(
  input: NakafaAgentQuranReferenceOptions,
  locale: Locale
) {
  return {
    from_verse: input.from_verse ?? 1,
    include_tafsir: input.include_tafsir ?? false,
    locale,
    surah: input.surah,
    ...(input.to_verse === undefined ? {} : { to_verse: input.to_verse }),
  };
}
