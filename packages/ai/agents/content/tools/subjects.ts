import type {
  GetSubjectsInput,
  GetSubjectsOutput,
} from "@repo/ai/agents/content/schema";
import { buildContentSlug, dedentString } from "@repo/ai/lib/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/connection/routes";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/**
 * Fetches subject index data and writes the matching UI data part state.
 */
export const getSubjects = Effect.fn("content.getSubjects")(function* ({
  input,
  toolCallId,
  writer,
}: {
  input: GetSubjectsInput;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const { locale, category, grade, material } = input;
  const slug = buildContentSlug({
    locale,
    filters: { type: "subject", category, grade, material },
  });
  const baseUrl = `/${slug}`;

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-subjects",
      data: {
        baseUrl,
        input: { locale, category, grade, material },
        status: "loading",
        subjects: [],
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
        type: "data-get-subjects",
        data: {
          baseUrl,
          input: { locale, category, grade, material },
          subjects: [],
          status: "error",
          error: error.message,
        },
      })
    );

    return formatOutput({ output: { baseUrl, subjects: [] } });
  }

  const subjects = data.map((item) => ({
    title: item.metadata.title,
    url: item.url,
    slug: item.slug,
    locale: item.locale,
  }));

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-subjects",
      data: {
        baseUrl,
        input: { locale, category, grade, material },
        subjects,
        status: "done",
      },
    })
  );

  return formatOutput({ output: { baseUrl, subjects } });
});

/**
 * Formats subject index data as source-backed markdown for the model.
 */
function formatOutput({ output }: { output: GetSubjectsOutput }) {
  return dedentString(`
    # Subjects List
    - Base URL: ${output.baseUrl}

    ${output.subjects
      .map(
        (subject, index) => `
    ## Subject ${index + 1}
    - Title: ${subject.title}
    - URL: ${subject.url}
    - Slug: ${subject.slug}
    - Locale: ${subject.locale}`
      )
      .join("\n")}
  `);
}
