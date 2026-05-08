import type {
  GetSubjectsInput,
  GetSubjectsOutput,
} from "@repo/ai/agents/content/schema";
import type { MyUIMessage } from "@repo/ai/types/message";
import { getSubjectContents } from "@repo/contents/_lib/subject/content";
import type { UIMessageStreamWriter } from "ai";
import dedent from "dedent";
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
  const basePath = ["subject", category, grade, material].join("/");
  const baseUrl = `/${locale}/${basePath}`;

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

  const contents = yield* getSubjectContents({
    locale,
    basePath,
    includeMDX: false,
  });
  const subjects = contents.map((item) => ({
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
  return dedent(`
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
