import { fetchExercises } from "@repo/ai/agents/content/tools/material/exercises";
import {
  normalizeMaterialSlug,
  resolveMaterialInput,
} from "@repo/ai/agents/content/tools/material/input";
import { fetchPage } from "@repo/ai/agents/content/tools/material/page";
import { fetchQuran } from "@repo/ai/agents/content/tools/material/quran";
import type { FetchParams } from "@repo/ai/agents/content/tools/material/types";
import { Effect } from "effect";

/**
 * Fetches Nakafa content and writes the matching UI data part state.
 */
export const fetchMaterial = Effect.fn("content.fetchMaterial")(function* ({
  context,
  input,
  locale,
  toolCallId,
  usePageInput,
  writer,
}: FetchParams) {
  const contentInput = yield* resolveMaterialInput({
    context,
    input,
    locale,
    usePageInput,
  });
  const cleanedSlug = yield* normalizeMaterialSlug(contentInput);
  const url = new URL(
    `/${contentInput.locale}/${cleanedSlug}`,
    "https://nakafa.com"
  ).toString();

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-content",
      data: {
        url,
        title: "",
        description: "",
        status: "loading",
      },
    })
  );

  const routeParams = {
    cleanedSlug,
    contentInput,
    toolCallId,
    url,
    writer,
  };

  if (cleanedSlug.startsWith("quran")) {
    return yield* fetchQuran(routeParams);
  }

  if (cleanedSlug.startsWith("exercises")) {
    return yield* fetchExercises(routeParams);
  }

  return yield* fetchPage(routeParams);
});
