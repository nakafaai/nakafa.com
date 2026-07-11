import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { fetchRuntimeCurriculumPage } from "@/lib/content/runtime/pages";

/** Loads one cached Convex material row for metadata and page rendering. */
export async function getMaterialPageData({
  locale,
  sourcePath,
}: {
  locale: Locale;
  sourcePath: string;
}) {
  "use cache";

  applyContentRuntimeCache();

  return await fetchRuntimeCurriculumPage({ locale, slug: sourcePath });
}
