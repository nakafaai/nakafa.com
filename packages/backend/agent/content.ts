import {
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { decodeAgentOutput } from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import { getAgentContentReferenceInput } from "@repo/backend/agent/ref";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { readQuranMarkdown as readQuranMarkdownQuery } from "@repo/backend/convex/contentRelease/quran/markdown";
import type {
  ContentReferenceInput,
  contentReferenceReturnValidator,
} from "@repo/backend/convex/contentRelease/reference/spec";
import { decodePublicRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/public/dispatch";
import type { PublicRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/public/internal";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import {
  type NakafaAgentMarkdown,
  NakafaAgentMarkdownSchema,
} from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { projectMdxForAgentMarkdown } from "@repo/contents/_types/llms/mdx";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Option, Schema } from "effect";

type PublishedRef = NakafaAgentContentRef & {
  readonly section: "articles" | "material";
};

const contentReference = makeFunctionReference<
  "query",
  { readonly input: ContentReferenceInput },
  Infer<typeof contentReferenceReturnValidator>
>("contentRelease/reference:read");

const publicRuntimeReference = makeFunctionReference<
  "query",
  {
    readonly appLocale: Schema.Schema.Type<typeof AppLocaleSchema>;
    readonly publicPath: string;
  },
  PublicRuntimeRow
>("contentRelease/runtime/public/internal:read");

const quranMarkdownReference = makeFunctionReference<
  "query",
  {
    readonly appLocale: AppLocaleCode;
    readonly surahNumber: number;
    readonly verseLimit?: number;
  },
  Effect.Success<ReturnType<typeof readQuranMarkdownQuery>>
>("contentRelease/quran:markdown");

/** Resolves and reads one public reference entirely inside Convex. */
export const getNakafaContent = Effect.fn("agent.getNakafaContent")(function* (
  ctx: ActionCtx,
  input: string
) {
  const lookup = getAgentContentReferenceInput(input);
  if (Option.isNone(lookup)) {
    return Option.none<NakafaAgentMarkdown>();
  }
  const reference = yield* readAgentQuery(
    ctx,
    contentReference,
    { input: lookup.value },
    "Unable to resolve the Nakafa content reference."
  );
  if (!reference) {
    return Option.none<NakafaAgentMarkdown>();
  }
  const ref = createNakafaContentRefFromGraphProjection(reference);
  if (Option.isNone(ref)) {
    return yield* contentReadError(
      "The signed content reference has an invalid graph identity."
    );
  }
  if (ref.value.section === "quran") {
    return yield* readQuranMarkdown(ctx, ref.value);
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
const readQuranMarkdown = Effect.fn("agent.readQuranMarkdown")(function* (
  ctx: ActionCtx,
  ref: NakafaAgentContentRef
) {
  const [section, value, extra] = ref.route.split("/");
  const surahNumber = parseQuranSurahNumber(value);
  if (section !== "quran" || extra !== undefined || surahNumber === null) {
    return Option.none<NakafaAgentMarkdown>();
  }
  const result = yield* readAgentQuery(
    ctx,
    quranMarkdownReference,
    { appLocale: ref.locale, surahNumber },
    "Unable to read signed Nakafa Quran markdown."
  );
  const publication = yield* decodePublishedQuranMarkdown(result, {
    appLocale: ref.locale,
    surahNumber,
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
  return ref.section === "articles" || ref.section === "material";
}

/** Parses one canonical Quran route segment through the signed contract. */
function parseQuranSurahNumber(value: string | undefined) {
  const decoded = Schema.decodeOption(QuranSurahNumberSchema)(Number(value));
  if (Option.isNone(decoded) || decoded.value.toString() !== value) {
    return null;
  }
  return decoded.value;
}

/** Maps integrity and rendering failures into the agent read contract. */
function contentReadError(error: unknown) {
  return new NakafaAgentDataReadError({
    cause: getUnknownErrorMessage(error),
    message: "Unable to read signed Nakafa public content.",
  });
}
