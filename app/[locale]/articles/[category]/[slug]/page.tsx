import {
  LayoutArticle,
  LayoutArticleContent,
  LayoutArticleFooter,
  LayoutArticleHeader,
} from "@/components/shared/layout-article";
import { RefContent } from "@/components/shared/ref-content";
import { getCategoryIcon } from "@/lib/utils/articles/category";
import { getSlugPath } from "@/lib/utils/articles/slug";
import { getContent } from "@/lib/utils/contents";
import { getReferences } from "@/lib/utils/contents";
import { getGithubUrl } from "@/lib/utils/github";
import { getHeadings, getRawContent } from "@/lib/utils/markdown";
import { getStaticParams } from "@/lib/utils/system";
import type { ArticleCategory } from "@/types/articles/category";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: Locale; category: ArticleCategory; slug: string }>;
};

export async function generateMetadata({
  params,
}: { params: Props["params"] }): Promise<Metadata> {
  const { locale, category, slug } = await params;
  const t = await getTranslations("Articles");

  const FILE_PATH = getSlugPath(category, slug);

  const content = await getContent(`${FILE_PATH}/${locale}.mdx`);

  if (!content) {
    return {
      title: t(category),
      alternates: {
        canonical: `/${locale}${FILE_PATH}`,
      },
    };
  }

  const { metadata } = content;

  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: `/${locale}${FILE_PATH}`,
    },
    authors: metadata.authors,
    category: t(category),
  };
}

// Generate bottom-up static params
export function generateStaticParams() {
  return getStaticParams({
    basePath: "contents/articles",
    paramNames: ["category", "slug"],
  });
}

export default async function Page({ params }: Props) {
  const { locale, category, slug } = await params;
  const t = await getTranslations("Articles");

  // Enable static rendering
  setRequestLocale(locale);

  const FILE_PATH = getSlugPath(category, slug);

  try {
    // Get the file, headings
    const [content, references, headings] = await Promise.all([
      getContent(`${FILE_PATH}/${locale}.mdx`),
      getReferences(FILE_PATH),
      getRawContent(`${FILE_PATH}/${locale}.mdx`).then(getHeadings),
    ]);

    if (!content) {
      notFound();
    }

    const { metadata, default: Content } = content;

    return (
      <LayoutArticle onThisPage={headings}>
        <LayoutArticleHeader
          metadata={metadata}
          category={{
            icon: getCategoryIcon(category),
            name: t(category),
          }}
        />
        <LayoutArticleContent>
          <Content />
        </LayoutArticleContent>
        <LayoutArticleFooter>
          <RefContent
            title={metadata.title}
            references={references}
            githubUrl={getGithubUrl(FILE_PATH)}
          />
        </LayoutArticleFooter>
      </LayoutArticle>
    );
  } catch {
    notFound();
  }
}
