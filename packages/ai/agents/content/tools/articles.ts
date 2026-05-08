import type {
  GetArticlesInput,
  GetArticlesOutput,
} from "@repo/ai/agents/content/schema";
import type { MyUIMessage } from "@repo/ai/types/message";
import { getArticleContents } from "@repo/contents/_lib/articles/content";
import type { UIMessageStreamWriter } from "ai";
import dedent from "dedent";
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
  const basePath = ["articles", category].join("/");
  const baseUrl = `/${locale}/${basePath}`;

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

  const contents = yield* getArticleContents({
    locale,
    basePath,
    includeMDX: false,
  });
  const articles = contents.map((item) => ({
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
  return dedent(`
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
