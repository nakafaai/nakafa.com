import {
  formatOutput,
  formatQuran,
} from "@repo/ai/agents/content/tools/material/output";
import type { RouteParams } from "@repo/ai/agents/content/tools/material/types";
import { getSurah } from "@repo/contents/_lib/quran";
import { Effect, Either } from "effect";

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
  const surahData = yield* Effect.either(getSurah(Number.parseInt(surah, 10)));

  if (Either.isLeft(surahData)) {
    const message =
      "Surah not found. Maybe not available or still in development.";

    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error: message,
        },
      })
    );

    return formatOutput({
      output: { url, content: message },
    });
  }

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-content",
      data: {
        url,
        title:
          surahData.right.name.translation[contentInput.locale] ||
          surahData.right.name.short,
        description:
          surahData.right.revelation[contentInput.locale] ||
          surahData.right.revelation.arab,
        status: "done",
      },
    })
  );

  return formatOutput({
    output: {
      url,
      content: formatQuran({
        output: surahData.right,
        locale: contentInput.locale,
      }),
    },
  });
});
