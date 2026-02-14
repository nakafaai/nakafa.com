import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import type { Locale } from "next-intl";
import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";

interface Params {
  locale: Locale;
  category: ArticleCategory;
  slug: string;
}

interface Props {
  children: React.ReactNode;
  params: Promise<Params>;
}

export default function Layout({ children, params }: Props) {
  const { locale, category, slug } = use(params);
  const filePath = getSlugPath(category, slug);

  return (
    <ContentViewTracker contentType="article" locale={locale} slug={filePath}>
      {children}
    </ContentViewTracker>
  );
}
