import "server-only";

import {
  type ContentFamily,
  ContentFamilySchema,
} from "@nakafa/aksara-contracts/content";
import {
  type GitCommitSha,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type AppLocale,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { Array as Arr, Effect, Schema } from "effect";
import { applyContentCache } from "@/lib/content/cache";
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

/** Reads one verified body-bearing artifact as agent-facing text data. */
const readPublishedTextData = Effect.fn("www.llms.published.data")(function* (
  input: PublishedMarkdownInput
) {
  const data = yield* readPublishedContent(input);
  const projection = yield* {
    article: decodePublishedArticle,
    material: decodeMaterialProjection,
    page: decodePublishedPage,
  }[input.family](data.projection, input);
  return {
    description: getMdxDescription(projection.metadata),
    publicPath: projection.publicPath,
    rawMdx: data.artifact.payload.rawMdx,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
    title: projection.metadata.title,
  };
});

/** Reads one verified body and projects it into agent-facing markdown text. */
const readPublishedText = Effect.fn("www.llms.published.read")(function* (
  input: PublishedMarkdownInput
) {
  const data = yield* readPublishedTextData(input);
  return yield* buildPublishedText({
    description: data.description,
    appLocale: input.appLocale,
    publicPath: data.publicPath,
    rawMdx: data.rawMdx,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
    title: data.title,
  });
});

/**
 * Caches one verified Aksara body under its exact shared content tags. The `use
 * cache` boundary stays so that the route handler still carries the scope tag
 * that expires it. Behind the boundary the content store keeps the text for the
 * release that the caller proved, so the signed body is read and projected once
 * for each release.
 */
export async function getCachedPublishedText(input: PublishedMarkdownInput) {
  "use cache";

  const text = await Effect.runPromise(
    readContentStore({
      kind: "markdown.text",
      load: readPublishedText(input),
      parts: [input.appLocale, input.family, input.publicPath],
      release: input.activeReleaseId,
      schema: Schema.String,
    })
  );
  applyContentCache(input.family);

  return text;
}
