import { parseArticleCategory } from "@repo/contents/_lib/articles/category";
import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import { cleanSlug } from "@repo/utilities/helper";
import { notFound } from "next/navigation";
import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Layout(
  props: LayoutProps<"/[locale]/articles/[category]/[slug]">
) {
  const { children, params } = props;
  const { locale: rawLocale, category: rawCategory, slug } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseArticleCategory(rawCategory);

  if (!category) {
    notFound();
  }

  const filePath = getSlugPath(category, slug);
  const cleanedSlug = cleanSlug(filePath);

  return (
    <ContentViewTracker
      contentView={{ type: "article", slug: cleanedSlug }}
      locale={locale}
    >
      {children}
    </ContentViewTracker>
  );
}
