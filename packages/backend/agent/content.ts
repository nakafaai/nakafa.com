import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { decodeAgentOutput } from "@repo/backend/agent/decode";
import { getAgentContentReferenceInput } from "@repo/backend/agent/ref";
import {
  decodePublishedQuranMarkdown,
  renderQuranReadingSourcesMarkdown,
  renderQuranTafsirAccessMarkdown,
} from "@repo/backend/client/quran/markdown";
import { renderQuranTranslationMarkdown } from "@repo/backend/client/quran/notes";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import type { agentContentSourceValidator } from "@repo/backend/confect/contentRelease/reference/spec";
import { decodePublicRuntimeRow } from "@repo/backend/content/publication/exchange";
import { formatQuranMeaning } from "@repo/backend/content/quran/contract";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/agent/errors";
import { createNakafaContentRefFromSummary } from "@repo/contents/agent/refs";
import {
  type NakafaAgentMarkdown,
  NakafaAgentMarkdownSchema,
} from "@repo/contents/agent/schema/read";
import type {
  NakafaAgentContentRef,
  NakafaAgentReadableContentRef,
} from "@repo/contents/agent/schema/ref";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { Effect, Option, Schema } from "effect";

type PublishedRef = NakafaAgentReadableContentRef & {
  readonly section: "articles" | "material";
};
type AgentContentSource = Schema.Schema.Type<
  typeof agentContentSourceValidator
>;
type QuranContentSource = Extract<
  NonNullable<AgentContentSource>,
  {
    readonly kind: "quran";
  }
>;
const contentSourceReference =
  refs.internal.contentRelease.reference.internal.readAgentContent;
const publicRuntimeReference =
  refs.internal.contentRelease.runtime.publication.internal.read;

/** Resolves and reads one public reference entirely inside Convex. */
export const getNakafaContent = Effect.fn("agent.getNakafaContent")(function* (
  input: string
) {
  const { runQuery } = yield* QueryRunner;
  const lookup = getAgentContentReferenceInput(input);
  if (Option.isNone(lookup)) {
    return Option.none<NakafaAgentMarkdown>();
  }
  const source = yield* runQuery(contentSourceReference, {
    input: lookup.value,
  }).pipe(
    Effect.mapError(
      (cause) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(cause),
          message: "Unable to resolve the Nakafa content reference.",
        })
    )
  );
  if (!source) {
    return Option.none<NakafaAgentMarkdown>();
  }
  const ref = createNakafaContentRefFromSummary(source.reference);
  if (Option.isNone(ref)) {
    return yield* contentReadError(
      "The signed content reference has an invalid graph identity."
    );
  }
  if (source.kind === "quran") {
    return yield* renderQuranMarkdown(ref.value, source);
  }
  if (isPublishedRef(ref.value)) {
    return yield* readPublishedMarkdown(ref.value);
  }
  return Option.none<NakafaAgentMarkdown>();
});

/** Reads one current article or lesson from its verified runtime row. */
const readPublishedMarkdown = Effect.fn("agent.readPublishedMarkdown")(
  function* (ref: PublishedRef) {
    const { runQuery } = yield* QueryRunner;
    const appLocale = yield* Schema.decodeEffect(AppLocaleSchema)(
      ref.locale
    ).pipe(Effect.mapError(contentReadError));
    const row = yield* runQuery(publicRuntimeReference, {
      appLocale,
      publicPath: ref.route,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(cause),
            message: "Unable to read signed Nakafa public content.",
          })
      )
    );
    const found = yield* decodePublicRuntimeRow(row).pipe(
      Effect.mapError(contentReadError)
    );
    if (!found) {
      return Option.none<NakafaAgentMarkdown>();
    }
    const expectedKind =
      ref.section === "articles" ? "article" : "subject-lesson";
    if (
      found.projection.kind !== expectedKind ||
      found.projection.graph.assetId !== ref.content_id
    ) {
      return yield* contentReadError(
        "The signed projection changed its requested public identity."
      );
    }
    const body = yield* projectMdxForAgentMarkdown(
      found.artifact.payload.rawMdx
    ).pipe(Effect.mapError(contentReadError));
    const metadata = found.projection.metadata;
    const description =
      metadata.description ??
      ("subject" in metadata ? metadata.subject : undefined);
    const markdown = yield* decodeAgentOutput(
      NakafaAgentMarkdownSchema,
      {
        ...ref,
        ...found.projection.graph,
        ...(description === undefined
          ? {}
          : {
              description,
            }),
        text: [`# ${metadata.title}`, "", body.trim()].join("\n"),
        title: metadata.title,
      },
      "Unable to build Nakafa agent markdown."
    );
    return Option.some(markdown);
  }
);

/** Renders one signed Quran surah as agent-readable markdown. */
const renderQuranMarkdown = Effect.fn("agent.renderQuranMarkdown")(function* (
  ref: NakafaAgentContentRef,
  source: QuranContentSource
) {
  const publication = yield* decodePublishedQuranMarkdown(source.markdown, {
    appLocale: ref.locale,
    surahNumber: source.surahNumber,
  }).pipe(Effect.mapError(contentReadError));
  const surah = publication.surah;
  const title = surah.name.transliteration;
  const meaning = formatQuranMeaning(surah.name.meaning, ref.locale);
  const description = meaning;
  const preBismillah =
    publication.preBismillah === null
      ? []
      : [
          publication.preBismillah.arabic,
          "",
          ...renderQuranTranslationMarkdown(
            publication.preBismillah.translation
          ),
          "",
        ];
  const markdown = yield* decodeAgentOutput(
    NakafaAgentMarkdownSchema,
    {
      ...ref,
      description,
      text: [
        `# ${title}`,
        "",
        `Meaning: ${meaning}`,
        `Revelation: ${surah.revelation.place}`,
        "",
        ...renderQuranReadingSourcesMarkdown(publication.sources),
        ...renderQuranTafsirAccessMarkdown(publication.tafsirAccess),
        "## Verses",
        "",
        ...preBismillah,
        ...publication.verses.flatMap((verse) => [
          `### Verse ${verse.number.inSurah}`,
          "",
          verse.arabic,
          "",
          ...renderQuranTranslationMarkdown(verse.translation),
          "",
        ]),
      ].join("\n"),
      title,
    },
    "Unable to build Nakafa agent markdown."
  );
  return Option.some(markdown);
});

/** Narrows content families with a signed Markdown artifact. */
function isPublishedRef(ref: NakafaAgentContentRef): ref is PublishedRef {
  return (
    ref.markdown_url !== undefined &&
    (ref.section === "articles" || ref.section === "material")
  );
}

/** Maps integrity and rendering failures into the agent read contract. */
function contentReadError(error: unknown) {
  return new NakafaAgentDataReadError({
    cause: getUnknownErrorMessage(error),
    message: "Unable to read signed Nakafa public content.",
  });
}
