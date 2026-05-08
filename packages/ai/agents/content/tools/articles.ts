import type {
  GetArticlesInput,
  GetArticlesOutput,
} from "@repo/ai/agents/content/schema";
import { buildContentSlug, dedentString } from "@repo/ai/lib/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/connection/routes";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/**
 * Fetches article index data and writes the matching UI data part state.
 */
export const getArticles = Effect.fn("content.getArticles")(function* ({
  input,
  toolCallId,
  writer,
}: {
  input: GetArticlesInput;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const { locale, category } = input;
  const slug = buildContentSlug({
    locale,
    filters: { type: "articles", category },
  });
  const baseUrl = `/${slug}`;

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-articles",
      data: {
        baseUrl,
        input: { locale, category },
        status: "loading",
        articles: [],
      },
    })
  );

  const { data, error } = yield* Effect.tryPromise(() =>
    api.contents.getContents({ slug })
  );

  if (error) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-articles",
        data: {
          baseUrl,
          input: { locale, category },
          articles: [],
          status: "error",
          error: error.message,
        },
      })
    );

    return formatOutput({ output: { baseUrl, articles: [] } });
  }

  const articles = data.map((item) => ({
    title: item.metadata.title,
    url: item.url,
    slug: item.slug,
    locale: item.locale,
  }));

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-articles",
      data: {
        baseUrl,
        input: { locale, category },
        articles,
        status: "done",
      },
    })
  );

  return formatOutput({ output: { baseUrl, articles } });
});

/**
 * Formats article index data as source-backed markdown for the model.
 */
function formatOutput({ output }: { output: GetArticlesOutput }) {
  return dedentString(`
    # Articles List
    - Base URL: ${output.baseUrl}

    ${output.articles
      .map(
        (article, index) => `
    ## Article ${index + 1}
    - Title: ${article.title}
    - URL: ${article.url}
    - Slug: ${article.slug}
    - Locale: ${article.locale}`
      )
      .join("\n")}
  `);
}
