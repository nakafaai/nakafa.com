import { formatOutput } from "@repo/ai/agents/content/tools/material/output";
import type { RouteParams } from "@repo/ai/agents/content/tools/material/types";
import { api } from "@repo/connection/routes";
import { Effect } from "effect";

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
  const { data, error } = yield* Effect.tryPromise(() =>
    api.contents.getContent({
      slug: `${contentInput.locale}/${cleanedSlug}`,
    })
  );

  if (error) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error: error.message,
        },
      })
    );

    return formatOutput({ output: { url, content: error.message } });
  }

  if (!data) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
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
        title: data.metadata.title,
        description: data.metadata.description || "",
        status: "done",
      },
    })
  );

  return formatOutput({ output: { url, content: data.raw } });
});
