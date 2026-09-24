import "server-only";

import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { GitCommitSha } from "@nakafa/aksara-contracts/ids";
import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { Effect } from "effect";
import { applyContentCache } from "@/lib/content/cache";
import { decodeMaterialProjection } from "@/lib/content/material/decode";
import {
  type PublishedContentInput,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import {
  decodePublishedArticle,
  decodePublishedPage,
} from "@/lib/content/published/projection";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader, getMdxDescription } from "@/lib/llms/format";
import { getRawAksaraUrl } from "@/lib/utils/github";

type PublishedMarkdownFamily = Extract<
  ContentFamily,
  "article" | "material" | "page"
>;

/** Exact public content identity required for agent-facing markdown. */
export interface PublishedMarkdownInput {
  readonly activeReleaseId: PublishedContentInput["activeReleaseId"];
  readonly appLocale: AppLocale;
  readonly family: PublishedMarkdownFamily;
  readonly publicPath: string;
}

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

  return [
    ...buildHeader({
      description,
      ...(source === undefined ? {} : { source }),
      title,
      url: `${BASE_URL}/${appLocale}/${publicPath}`,
    }),
    body,
  ].join("\n");
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

/** Caches one verified Aksara body under its exact shared content tags. */
export async function getCachedPublishedText(input: PublishedMarkdownInput) {
  "use cache";

  const data = await Effect.runPromise(readPublishedTextData(input));
  applyContentCache(input.family);

  return await Effect.runPromise(
    buildPublishedText({
      description: data.description,
      appLocale: input.appLocale,
      publicPath: data.publicPath,
      rawMdx: data.rawMdx,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
      title: data.title,
    })
  );
}
