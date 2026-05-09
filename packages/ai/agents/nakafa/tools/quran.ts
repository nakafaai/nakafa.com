import { formatQuran } from "@repo/ai/agents/nakafa/format";
import { previewQuran } from "@repo/ai/agents/nakafa/preview";
import type { MyUIMessage } from "@repo/ai/types/message";
import { NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES } from "@repo/contents/_lib/agent/constants";
import type { NakafaAgentQuranReferenceOptions } from "@repo/contents/_lib/agent/schema/quran";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import type { Locale } from "@repo/contents/_types/content";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either, Option } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

interface Params {
  input: NakafaAgentQuranReferenceOptions;
  locale: Locale;
  toolCallId: string;
  writer: Writer;
}

const invalidRangeMessage = "Invalid Quran verse range.";
const notFoundMessage = "Nakafa Quran reference was not found.";
const oversizedRangeMessage = "Quran reference range is too large.";

/** Reads a bounded Nakafa Quran reference and writes a preview UI part. */
export const quran = Effect.fn("nakafa.quran")(function* ({
  input,
  locale,
  toolCallId,
  writer,
}: Params) {
  const dataInput = normalizeQuranInput(input, locale);

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "quran",
        input: dataInput,
        status: "loading",
      },
    })
  );

  const fromVerse = dataInput.from_verse;
  const toVerse = dataInput.to_verse ?? fromVerse;
  const requestedVerseCount = toVerse - fromVerse + 1;

  if (toVerse < fromVerse) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "quran",
          input: dataInput,
          status: "error",
          error: invalidRangeMessage,
        },
      })
    );

    return invalidRangeMessage;
  }

  if (requestedVerseCount > NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "quran",
          input: dataInput,
          status: "error",
          error: oversizedRangeMessage,
        },
      })
    );

    return oversizedRangeMessage;
  }

  const result = yield* Effect.either(Nakafa.quran(dataInput));

  if (Either.isLeft(result)) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "quran",
          input: dataInput,
          status: "error",
          error: result.left.message,
        },
      })
    );

    return result.left.message;
  }

  const content = result.right;

  if (Option.isNone(content)) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "quran",
          input: dataInput,
          status: "error",
          error: notFoundMessage,
        },
      })
    );

    return notFoundMessage;
  }

  const value = content.value;

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "quran",
        input: dataInput,
        status: "done",
        result: previewQuran(value),
      },
    })
  );

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
