import "server-only";

import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { GitCommitSha } from "@nakafa/aksara-contracts/ids";
import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import {
  preserveMdxSourceForAgentMarkdown,
  projectMdxForAgentMarkdown,
} from "@repo/contents/_types/llms/mdx";
import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import { readPublishedArticle } from "@/lib/content/published/article";
import { readPublishedMaterial } from "@/lib/content/published/material";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader, getMdxDescription } from "@/lib/llms/format";
import { getRawAksaraUrl } from "@/lib/utils/github";

type PublishedMarkdownFamily = Extract<ContentFamily, "article" | "material">;

/** Exact public content identity required for agent-facing markdown. */
export interface PublishedMarkdownInput {
  readonly activeReleaseId: Parameters<
    typeof readPublishedArticle
  >[0]["activeReleaseId"];
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
  const body = yield* projectMdxForAgentMarkdown(rawMdx).pipe(
    Effect.catchTag("MdxAgentProjectionError", () =>
      Effect.succeed(preserveMdxSourceForAgentMarkdown(rawMdx))
    )
  );
  const source = sourceRevision
    ? getRawAksaraUrl({
        path: sourcePath,
        revision: sourceRevision,
      })
    : undefined;

  return [
    ...buildHeader({
      description,
      source,
      title,
      url: `${BASE_URL}/${appLocale}/${publicPath}`,
    }),
    body,
  ].join("\n");
});

/** Reads one verified article or material artifact as agent-facing text data. */
const readPublishedTextData = Effect.fn("www.llms.published.data")(function* (
  input: PublishedMarkdownInput
) {
  if (input.family === "article") {
    const data = yield* readPublishedArticle(input);
    return {
      artifactHash: data.artifact.artifactHash,
      description: getMdxDescription(data.projection.metadata),
      publicPath: data.projection.publicPath,
      rawMdx: data.artifact.payload.rawMdx,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
      title: data.projection.metadata.title,
    };
  }

  const data = yield* readPublishedMaterial(input);
  return {
    artifactHash: data.artifact.artifactHash,
    description: getMdxDescription(data.metadata),
    publicPath: data.projection.publicPath,
    rawMdx: data.artifact.payload.rawMdx,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
    title: data.metadata.title,
  };
});

/** Caches one verified Aksara body under its exact shared content tags. */
export async function getCachedPublishedText(input: PublishedMarkdownInput) {
  "use cache";

  const data = await Effect.runPromise(readPublishedTextData(input));
  applyPublishedContentCache(input.family, data.artifactHash);

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
