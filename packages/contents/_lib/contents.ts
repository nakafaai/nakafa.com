import type { Locale } from "next-intl";
import { getContent, getNestedSlugs } from "./utils";

export async function getContents({
  locale = "en",
  basePath = "",
}: {
  locale?: Locale;
  basePath?: string;
}) {
  // Get all nested slug paths recursively
  const allSlugs = getNestedSlugs(basePath);

  // Fetch content for each slug path
  const contents = await Promise.all(
    allSlugs
      .map(async (slugArray) => {
        const slugPath = slugArray.join("/");
        const fullPath = `${basePath}/${slugPath}`;
        const content = await getContent(locale, fullPath);

        if (!content) {
          return null;
        }

        return {
          ...content.metadata,
          url: `/${locale}/${fullPath}`,
        };
      })
      .filter((item) => item !== null)
  );

  return contents;
}
