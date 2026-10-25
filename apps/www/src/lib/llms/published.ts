import "@tanstack/react-start/server-only";

import {
  type ContentFamily,
  ContentFamilySchema,
} from "@nakafa/aksara-contracts/content";
import {
  type GitCommitSha,
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type AppLocale,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import { PublicContentRuntimeFoundSchema } from "@nakafa/aksara-contracts/runtime/spec";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { Array as Arr, Effect, Schema } from "effect";
import { decodeMaterialProjection } from "@/lib/content/material/decode";
import { readPublishedContent } from "@/lib/content/published/exchange";
import {
  decodePublishedArticle,
  decodePublishedPage,
} from "@/lib/content/published/projection";
import { getRawAksaraUrl } from "@/lib/content/repository";
import { readContentStore } from "@/lib/content/store/read";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader, getMdxDescription } from "@/lib/llms/format";

type PublishedMarkdownFamily = Extract<
  ContentFamily,
  "article" | "material" | "page"
>;

const PublishedMarkdownFamilySchema = Schema.Literals(
  Arr.filter(
    ContentFamilySchema.literals,
    (family): family is PublishedMarkdownFamily => family !== "question"
  )
);

/** Exact public content identity required for agent-facing markdown. */
const PublishedMarkdownInputSchema = Schema.Struct({
  activeReleaseId: ReleaseIdSchema,
  appLocale: AppLocaleSchema,
  family: PublishedMarkdownFamilySchema,
  publicPath: Schema.String,
});
export type PublishedMarkdownInput = typeof PublishedMarkdownInputSchema.Type;

/** Builds agent markdown from reviewed MDX and immutable Git provenance. */
const buildPublishedText = Effect.fn("www.llms.published.text")(function* ({
  description,
  appLocale,
  publicPath,
  rawMdx,
  sourcePath,
  sourceRevision,
  title,
}: {
  description: string;
  appLocale: AppLocale;
  publicPath: string;
  rawMdx: string;
  sourcePath: string;
  sourceRevision: GitCommitSha | null;
  title: string;
}) {
  const body = yield* projectMdxForAgentMarkdown(rawMdx);
  const source = sourceRevision
    ? getRawAksaraUrl({
        path: sourcePath,
        revision: sourceRevision,
      })
    : undefined;

  return Arr.join(
    [
      ...buildHeader({
        description,
        ...(source === undefined ? {} : { source }),
        title,
        url: `${BASE_URL}/${appLocale}/${publicPath}`,
      }),
      body,
    ],
    "\n"
  );
});

/**
 * What Convex answered for one body: its signed projection and its raw source
 * with the provenance of the release. The content store keeps exactly this and
 * nothing that code derives from it, so a deploy that changes the projection of
 * the Markdown, the header or the site address takes effect at once.
 */
const PublishedMarkdownSourceSchema = Schema.Struct({
  projection: ContentProjectionSchema,
  rawMdx: Schema.String,
  sourcePath: PublicContentRuntimeFoundSchema.fields.sourcePath,
  sourceRevision: Schema.NullOr(GitCommitShaSchema),
});

/** Reads the signed source of one verified body-bearing artifact. */
const readPublishedMarkdownSource = Effect.fn("www.llms.published.source")(
  function* (input: PublishedMarkdownInput) {
    const data = yield* readPublishedContent(input);
    return {
      projection: data.projection,
      rawMdx: data.artifact.payload.rawMdx,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    } satisfies typeof PublishedMarkdownSourceSchema.Type;
  }
);

/**
 * Reads the stored signed source of one body, then derives its agent-facing
 * Markdown text from it. The source is read from Convex once for each release
 * that the caller proved; the text is derived on every fill.
 */
export const readPublishedText = Effect.fn("www.llms.published.read")(
  function* (input: PublishedMarkdownInput) {
    const source = yield* readContentStore({
      kind: "markdown.source",
      load: readPublishedMarkdownSource(input),
      parts: [input.appLocale, input.family, input.publicPath],
      release: input.activeReleaseId,
      schema: PublishedMarkdownSourceSchema,
    });
    const projection = yield* {
      article: decodePublishedArticle,
      material: decodeMaterialProjection,
      page: decodePublishedPage,
    }[input.family](source.projection, input);
    return yield* buildPublishedText({
      description: getMdxDescription(projection.metadata),
      appLocale: input.appLocale,
      publicPath: projection.publicPath,
      rawMdx: source.rawMdx,
      sourcePath: source.sourcePath,
      sourceRevision: source.sourceRevision,
      title: projection.metadata.title,
    });
  }
);
