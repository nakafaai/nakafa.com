import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import { routing } from "@repo/internationalization/src/routing";
import { cleanSlug } from "@repo/utilities/helper";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";

type Props = LayoutProps<"/[locale]/articles/[category]/[slug]"> & {
  params: Promise<{
    category: ArticleCategory;
    locale: string;
    slug: string;
  }>;
};

export default function Layout(props: Props) {
  const { children, params } = props;
  const { locale, category, slug } = use(params);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

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
