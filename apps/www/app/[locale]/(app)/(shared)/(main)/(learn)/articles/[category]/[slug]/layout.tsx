import { parseArticleCategory } from "@repo/contents/_lib/articles/category";
import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import { cleanSlug } from "@repo/utilities/helper";
import { Option } from "effect";
import { notFound } from "next/navigation";
import { ContentViewTracker } from "@/components/tracking/tracker";
import { getRuntimeContentViewId } from "@/lib/content/views";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Layout(
  props: LayoutProps<"/[locale]/articles/[category]/[slug]">
) {
  const { children, params } = props;
  const { locale: rawLocale, category: rawCategory, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const parsedCategory = parseArticleCategory(rawCategory);

  if (Option.isNone(parsedCategory)) {
    notFound();
  }

  const category = parsedCategory.value;
  const filePath = getSlugPath(category, slug);
  const cleanedSlug = cleanSlug(filePath);
  const contentId = await getRuntimeContentViewId({
    locale,
    route: cleanedSlug,
  });

  if (!contentId) {
    return children;
  }

  return (
    <ContentViewTracker contentId={contentId} locale={locale}>
      {children}
    </ContentViewTracker>
  );
}
