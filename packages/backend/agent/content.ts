import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { decodeAgentOutput } from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import { getAgentContentReferenceInput } from "@repo/backend/agent/ref";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { agentContentSourceValidator } from "@repo/backend/convex/contentRelease/reference/agent";
import type { ContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/spec";
import { decodePublicRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/public/dispatch";
import type { PublicRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/public/internal";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import {
  createNakafaContentRefFromGraphProjection,
  createNakafaContentRefFromSummary,
} from "@repo/contents/_lib/agent/refs";
import {
  type NakafaAgentMarkdown,
  NakafaAgentMarkdownSchema,
} from "@repo/contents/_lib/agent/schema/read";
import type {
  NakafaAgentContentRef,
  NakafaAgentReadableContentRef,
} from "@repo/contents/_lib/agent/schema/ref";
import { projectMdxForAgentMarkdown } from "@repo/contents/_types/llms/mdx";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Option, Schema } from "effect";

type PublishedRef = NakafaAgentReadableContentRef & {
  readonly section: "articles" | "material";
};

type AgentContentSource = Infer<typeof agentContentSourceValidator>;
type QuranContentSource = Extract<
  NonNullable<AgentContentSource>,
  { readonly kind: "quran" }
>;

const contentSourceReference = makeFunctionReference<
  "query",
  { readonly input: ContentReferenceInput },
  AgentContentSource
>("contentRelease/reference/agent:read");

const publicRuntimeReference = makeFunctionReference<
  "query",
  {
    readonly appLocale: Schema.Schema.Type<typeof AppLocaleSchema>;
    readonly publicPath: string;
  },
  PublicRuntimeRow
>("contentRelease/runtime/public/internal:read");

/** Resolves and reads one public reference entirely inside Convex. */
export const getNakafaContent = Effect.fn("agent.getNakafaContent")(function* (
  ctx: ActionCtx,
  input: string
) {
  const lookup = getAgentContentReferenceInput(input);
  if (Option.isNone(lookup)) {
    return Option.none<NakafaAgentMarkdown>();
  }
  const source = yield* readAgentQuery(
    ctx,
    contentSourceReference,
    { input: lookup.value },
    "Unable to resolve the Nakafa content reference."
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
    if (ref.value.section !== "quran") {
      return yield* contentReadError(
        "The signed Quran source has an inconsistent section identity."
      );
    }
    return yield* renderQuranMarkdown(ref.value, source);
  }
  if (ref.value.section === "quran") {
    return yield* contentReadError(
      "The signed Quran reference is missing its transactional source."
    );
  }
  if (isPublishedRef(ref.value)) {
    return yield* readPublishedMarkdown(ctx, ref.value);
  }
  return Option.none<NakafaAgentMarkdown>();
});

/** Reads one current article or lesson from its verified runtime row. */
const readPublishedMarkdown = Effect.fn("agent.readPublishedMarkdown")(
  function* (ctx: ActionCtx, ref: PublishedRef) {
    const appLocale = yield* Schema.decodeEffect(AppLocaleSchema)(
      ref.locale
    ).pipe(Effect.mapError(contentReadError));
    const row = yield* readAgentQuery(
      ctx,
      publicRuntimeReference,
      { appLocale, publicPath: ref.route },
      "Unable to read signed Nakafa public content."
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
      found.projection.graph.assetId !== ref.content_id ||
      found.projection.appLocale !== ref.locale ||
      `${found.projection.publicPath}` !== `${ref.route}`
    ) {
      return yield* contentReadError(
        "The signed projection changed its requested public identity."
      );
    }
    const currentRef = createNakafaContentRefFromGraphProjection({
      ...found.projection.graph,
      content_id: found.projection.graph.assetId,
      locale: found.projection.appLocale,
      route: found.projection.publicPath,
      section: ref.section,
    });
    if (Option.isNone(currentRef)) {
      return yield* contentReadError(
        "The signed projection has an invalid public graph identity."
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
        ...currentRef.value,
        ...(description === undefined ? {} : { description }),
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
  const title = publication.surah.name.transliteration;
  const description = publication.surah.name.translation;
  const markdown = yield* decodeAgentOutput(
    NakafaAgentMarkdownSchema,
    {
      ...ref,
      description,
      text: [
        `# ${title}`,
        "",
        `Translation: ${description}`,
        `Revelation: ${publication.surah.revelation.place}`,
        "",
        "## Verses",
        "",
        ...publication.verses.flatMap((verse) => [
          `### Verse ${verse.number.inSurah}`,
          "",
          verse.arabic,
          "",
          `Translation: ${verse.translation.text}`,
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
