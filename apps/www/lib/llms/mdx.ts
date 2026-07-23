import {
  preserveMdxSourceForAgentMarkdown,
  projectMdxForAgentMarkdown,
} from "@repo/contents/_types/llms/mdx";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  getRuntimeArticlePage,
  getRuntimeCurriculumPage,
} from "@/lib/content/runtime/pages";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader, getMdxDescription } from "@/lib/llms/format";
import { getRawGithubUrl } from "@/lib/utils/github";

/** Runs the cached MDX markdown Effect at the Next cache boundary. */
export async function getCachedLlmsMdxText({
  cleanSlug,
  locale,
  publicSlug,
}: {
  cleanSlug: string;
  locale: Locale;
  publicSlug?: string;
}) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(
    getLlmsMdxText({ cleanSlug, locale, publicSlug })
  );
}

/** Builds uncached markdown for one article or subject MDX content page. */
export const getLlmsMdxText = Effect.fn("www.llms.mdx.text")(function* ({
  cleanSlug,
  locale,
  publicSlug,
}: {
  cleanSlug: string;
  locale: Locale;
  publicSlug?: string;
}) {
  const content = yield* getMdxRuntimePage({ cleanSlug, locale });

  if (!content) {
    return null;
  }

  const body = yield* projectMdxForAgentMarkdown(content.body).pipe(
    Effect.catchTag("MdxAgentProjectionError", () =>
      Effect.succeed(preserveMdxSourceForAgentMarkdown(content.body))
    )
  );
  const scanned = [
    ...buildHeader({
      url: `${BASE_URL}/${locale}/${publicSlug ?? cleanSlug}`,
      description: getMdxDescription(content.metadata),
      source: getRawGithubUrl(`/packages/contents/${cleanSlug}/${locale}.mdx`),
    }),
    body,
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

  if (
    cleanSlug.startsWith("curriculum/") ||
    cleanSlug.startsWith("material/lesson/")
  ) {
    return yield* getRuntimeCurriculumPage({
      locale,
      slug: cleanSlug,
    });
  }

  return null;
});
