import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  getRuntimeArticlePage,
  getRuntimeSubjectPage,
} from "@/lib/content/runtime";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";
import { getRawGithubUrl } from "@/lib/utils/github";

/** Runs the cached MDX markdown Effect at the Next cache boundary. */
export async function getCachedLlmsMdxText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(getLlmsMdxText({ cleanSlug, locale }));
}

/** Builds uncached markdown for one article or subject MDX content page. */
export const getLlmsMdxText = Effect.fn("www.llms.mdx.text")(function* ({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  const content = yield* getMdxRuntimePage({ cleanSlug, locale });

  if (!content) {
    return null;
  }

  const scanned = [
    ...buildHeader({
      url: `${BASE_URL}/${locale}/${cleanSlug}`,
      description: getPageDescription(content),
      source: getRawGithubUrl(`/packages/contents/${cleanSlug}/${locale}.mdx`),
    }),
    content.body,
  ];

  return scanned.join("\n");
});

/** Loads one article or subject markdown page from the Convex runtime model. */
const getMdxRuntimePage = Effect.fn("www.llms.mdx.runtimePage")(function* ({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  if (cleanSlug.startsWith("articles/")) {
    return yield* getRuntimeArticlePage({
      locale,
      slug: cleanSlug,
    });
  }

  if (cleanSlug.startsWith("subject/")) {
    return yield* getRuntimeSubjectPage({
      locale,
      slug: cleanSlug,
    });
  }

  return null;
});

type RuntimeMdxPage = NonNullable<
  Effect.Effect.Success<ReturnType<typeof getMdxRuntimePage>>
>;

/** Returns a markdown description with subject fallback for subject lessons. */
function getPageDescription(content: RuntimeMdxPage) {
  if (content.metadata.description) {
    return content.metadata.description;
  }

  if ("subject" in content.metadata) {
    return (
      content.metadata.subject ??
      "Output docs content for large language models."
    );
  }

  return "Output docs content for large language models.";
}
