import "server-only";

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import {
  preserveMdxSourceForAgentMarkdown,
  projectMdxForAgentMarkdown,
} from "@repo/contents/_types/llms/mdx";
import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import {
  type PublishedMaterialData,
  type PublishedMaterialInput,
  readPublishedMaterial,
} from "@/lib/content/published/exchange";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader, getMdxDescription } from "@/lib/llms/format";
import { getRawAksaraUrl } from "@/lib/utils/github";

/** Builds projected agent markdown from one verified Aksara material. */
const buildPublishedText = Effect.fn("www.llms.published.text")(function* ({
  data,
  locale,
}: {
  data: PublishedMaterialData;
  locale: ContentLocale;
}) {
  const body = yield* projectMdxForAgentMarkdown(
    data.artifact.payload.rawMdx
  ).pipe(
    Effect.catchTag("MdxAgentProjectionError", () =>
      Effect.succeed(
        preserveMdxSourceForAgentMarkdown(data.artifact.payload.rawMdx)
      )
    )
  );
  const source = data.sourceRevision
    ? getRawAksaraUrl({
        path: data.sourcePath,
        revision: data.sourceRevision,
      })
    : undefined;

  return [
    ...buildHeader({
      description: getMdxDescription(data.metadata),
      source,
      url: `${BASE_URL}/${locale}/${data.route.publicPath}`,
    }),
    body,
  ].join("\n");
});

/** Caches verified Aksara markdown under the exact shared material tags. */
export async function getCachedPublishedText(input: PublishedMaterialInput) {
  "use cache";

  applyPublishedContentCache();
  const data = await Effect.runPromise(readPublishedMaterial(input));

  return await Effect.runPromise(
    buildPublishedText({ data, locale: input.locale })
  );
}
