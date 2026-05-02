import { getContentMetadataWithRaw } from "@repo/contents/_lib/metadata";
import { Effect } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";
import { getRawGithubUrl } from "@/lib/utils/github";

/** Builds markdown for one article or subject MDX content page. */
export async function getCachedLlmsMdxText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  "use cache";

  cacheLife("max");

  const content = await Effect.runPromise(
    Effect.match(getContentMetadataWithRaw(locale, cleanSlug), {
      onFailure: () => null,
      onSuccess: (data) => data,
    })
  );

  if (!content) {
    return null;
  }

  const scanned = [
    ...buildHeader({
      url: `${BASE_URL}/${locale}/${cleanSlug}`,
      description: "Output docs content for large language models.",
      source: getRawGithubUrl(`/packages/contents/${cleanSlug}/${locale}.mdx`),
    }),
    content.raw,
  ];

  return scanned.join("\n");
}
