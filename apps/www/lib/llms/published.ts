import "server-only";

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { GitCommitSha } from "@nakafa/aksara-contracts/ids";
import {
  preserveMdxSourceForAgentMarkdown,
  projectMdxForAgentMarkdown,
} from "@repo/contents/_types/llms/mdx";
import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import {
  type PublishedMaterialInput,
  readPublishedMaterial,
} from "@/lib/content/published/material";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader, getMdxDescription } from "@/lib/llms/format";
import { getRawAksaraUrl } from "@/lib/utils/github";

/** Builds agent markdown from reviewed MDX and immutable Git provenance. */
const buildPublishedText = Effect.fn("www.llms.published.text")(function* ({
  description,
  locale,
  publicPath,
  rawMdx,
  sourcePath,
  sourceRevision,
}: {
  description: string;
  locale: ContentLocale;
  publicPath: string;
  rawMdx: string;
  sourcePath: string;
  sourceRevision: GitCommitSha | null;
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
      url: `${BASE_URL}/${locale}/${publicPath}`,
    }),
    body,
  ].join("\n");
});

/** Caches verified Aksara markdown under the exact shared material tags. */
export async function getCachedPublishedMaterialText(
  input: PublishedMaterialInput
) {
  "use cache";

  const data = await Effect.runPromise(readPublishedMaterial(input));
  applyPublishedContentCache("material", data.artifact.artifactHash);

  return await Effect.runPromise(
    buildPublishedText({
      description: getMdxDescription(data.metadata),
      locale: input.locale,
      publicPath: data.route.publicPath,
      rawMdx: data.artifact.payload.rawMdx,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    })
  );
}
