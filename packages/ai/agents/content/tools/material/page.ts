import { formatOutput } from "@repo/ai/agents/content/tools/material/output";
import type { RouteParams } from "@repo/ai/agents/content/tools/material/types";
import { getContent } from "@repo/contents/_lib/content";
import { Effect, Either } from "effect";

/**
 * Fetches a normal content page and writes the matching UI data part state.
 */
export const fetchPage = Effect.fn("content.fetchPage")(function* ({
  cleanedSlug,
  contentInput,
  toolCallId,
  url,
  writer,
}: RouteParams) {
  const content = yield* Effect.either(
    getContent(contentInput.locale, cleanedSlug, { includeMDX: false })
  );

  if (Either.isLeft(content)) {
    const message =
      "Content not found. Maybe not available or still in development.";

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

    return formatOutput({ output: { url, content: message } });
  }

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-content",
      data: {
        url,
        title: content.right.metadata.title,
        description: content.right.metadata.description || "",
        status: "done",
      },
    })
  );

  return formatOutput({ output: { url, content: content.right.raw } });
});
