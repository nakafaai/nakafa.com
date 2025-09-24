import { getCategoryIcon } from "@repo/contents/_lib/articles/category";
import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import { getHeadings } from "@repo/contents/_lib/toc";
import { getContent, getReferences } from "@repo/contents/_lib/utils";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { formatISO } from "date-fns";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  LayoutArticle,
  LayoutArticleContent,
  LayoutArticleFooter,
  LayoutArticleHeader,
} from "@/components/shared/layout-article";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

type Props = {
  params: Promise<{
    locale: Locale;
    category: ArticleCategory;
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, slug } = await params;
  const t = await getTranslations("Articles");

  const FilePath = getSlugPath(category, slug);

  const content = await getContent(locale, FilePath);

  const path = `/${locale}${FilePath}`;
  const alternates = {
    canonical: path,
  };
  const image = {
    url: getOgUrl(locale, FilePath),
    width: 1200,
    height: 630,
  };
  const twitter: Metadata["twitter"] = {
    images: [image],
  };
  const openGraph: Metadata["openGraph"] = {
    url: path,
    images: [image],
    type: "article",
    siteName: "Nakafa",
    locale,
  };

  if (!content) {
    return {
      title: t(category),
      alternates,
      openGraph,
      twitter,
    };
  }

  const { metadata } = content;

  return {
    title: {
      absolute: `${metadata.title} - ${t(category)}`,
    },
    description: metadata.description,
    alternates,
    authors: metadata.authors,
    category: t(category),
    keywords: metadata.title
      .split(" ")
      .concat(metadata.description?.split(" ") ?? [])
      .filter((keyword) => keyword.length > 0),
    openGraph,
    twitter,
  };
}

// Generate bottom-up static params
export function generateStaticParams() {
  return getStaticParams({
    basePath: "articles",
    paramNames: ["category", "slug"],
  });
}

export default async function Page({ params }: Props) {
  const { locale, category, slug } = await params;
  const t = await getTranslations("Articles");

  // Enable static rendering
  setRequestLocale(locale);

  const FilePath = getSlugPath(category, slug);

  try {
    // Get the file, headings
    const [content, references] = await Promise.all([
      getContent(locale, FilePath),
      getReferences(FilePath),
    ]);

    if (!content) {
      notFound();
    }

    const { metadata, default: Content } = content;

    const headings = getHeadings(content.raw);

    return (
      <>
        <BreadcrumbJsonLd
          breadcrumbItems={headings.map((heading, index) => ({
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}${FilePath}${heading.href}`,
            position: index + 1,
            name: heading.label,
            item: `https://nakafa.com/${locale}${FilePath}${heading.href}`,
          }))}
          description={metadata.description ?? ""}
          locale={locale}
          name={metadata.title}
        />
        <ArticleJsonLd
          author={metadata.authors.map((author) => ({
            "@type": "Person",
            name: author.name,
            url: `https://nakafa.com/${locale}/contributor`,
          }))}
          datePublished={formatISO(metadata.date)}
          description={metadata.description ?? ""}
          headline={metadata.title}
          image={getOgUrl(locale, FilePath)}
        />
        <LearningResourceJsonLd
          author={metadata.authors.map((author) => ({
            "@type": "Person",
            name: author.name,
            url: `https://nakafa.com/${locale}/contributor`,
          }))}
          datePublished={formatISO(metadata.date)}
          description={metadata.description ?? ""}
          educationalLevel={t(category)}
          name={metadata.title}
        />
        <LayoutArticle onThisPage={headings}>
          <LayoutArticleHeader
            authors={metadata.authors}
            category={{
              icon: getCategoryIcon(category),
              name: t(category),
            }}
            date={metadata.date}
            description={metadata.description}
            showAskAi
            slug={`/${locale}${FilePath}`}
            title={metadata.title}
          />
          <LayoutArticleContent>
            <Content />
          </LayoutArticleContent>
          <LayoutArticleFooter>
            <RefContent
              githubUrl={getGithubUrl({
                path: `/packages/contents${FilePath}`,
              })}
              references={references}
              title={metadata.title}
            />
          </LayoutArticleFooter>
        </LayoutArticle>
      </>
    );
  } catch {
    notFound();
  }
}
