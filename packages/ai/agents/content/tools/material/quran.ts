import { api } from "@repo/connection/routes";
import { Effect } from "effect";
import { formatOutput, formatQuran } from "./output";
import type { RouteParams } from "./types";

const QURAN_SLUG_PARTS_COUNT = 2;

/**
 * Fetches Quran surah content and writes the matching UI data part state.
 */
export const fetchQuran = Effect.fn("content.fetchQuran")(function* ({
  cleanedSlug,
  contentInput,
  toolCallId,
  url,
  writer,
}: RouteParams) {
  const slugParts = cleanedSlug.split("/");

  if (slugParts.length !== QURAN_SLUG_PARTS_COUNT) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error:
            "Surah not found. Maybe not available or still in development.",
        },
      })
    );

    return formatOutput({ output: { url, content: "" } });
  }

  const surah = slugParts[1];
  const { data: surahData, error: surahError } = yield* Effect.tryPromise(() =>
    api.contents.getSurah({
      surah: Number.parseInt(surah, 10),
    })
  );

  if (surahError) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error: surahError.message,
        },
      })
    );

    return formatOutput({
      output: { url, content: surahError.message },
    });
  }

  if (!surahData) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error:
            "Surah not found. Maybe not available or still in development.",
        },
      })
    );

    return formatOutput({ output: { url, content: "" } });
  }

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-content",
      data: {
        url,
        title:
          surahData.name.translation[contentInput.locale] ||
          surahData.name.short,
        description:
          surahData.revelation[contentInput.locale] ||
          surahData.revelation.arab,
        status: "done",
      },
    })
  );

  return formatOutput({
    output: {
      url,
      content: formatQuran({
        output: surahData,
        locale: contentInput.locale,
      }),
    },
  });
});
