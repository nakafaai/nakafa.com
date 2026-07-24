import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { ContentViewTracker } from "@/components/tracking/tracker";
import { getContentViewId } from "@/lib/content/views";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Wraps article pages with graph content-view tracking when the route resolves. */
export default async function Layout(
  props: LayoutProps<"/[locale]/articles/[category]/[slug]">
) {
  const { children, params } = props;
  const { locale: rawLocale, category: rawCategory, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);

  if (!Schema.is(ArticleCategorySchema)(rawCategory)) {
    notFound();
  }

  const contentId = getContentViewId({
    locale,
    route: `articles/${rawCategory}/${slug}`,
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
