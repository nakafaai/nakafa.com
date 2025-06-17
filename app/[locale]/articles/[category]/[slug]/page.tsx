import { ArticleJsonLd } from "@/components/json-ld/article";
import { BreadcrumbJsonLd } from "@/components/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@/components/json-ld/learning-resource";
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
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";
import type { ArticleCategory } from "@/types/articles/category";
import { formatISO } from "date-fns";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

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
}: { params: Props["params"] }): Promise<Metadata> {
  const { locale, category, slug } = await params;
  const t = await getTranslations("Articles");

  const FILE_PATH = getSlugPath(category, slug);

  const content = await getContent(locale, FILE_PATH);

  const path = `/${locale}${FILE_PATH}`;
  const alternates = {
    canonical: path,
  };
  const image = {
    url: getOgUrl(locale, FILE_PATH),
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
    openGraph,
    twitter,
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
      getContent(locale, FILE_PATH),
      getReferences(FILE_PATH),
      getRawContent(`${FILE_PATH}/${locale}.mdx`).then(getHeadings),
    ]);

    if (!content) {
      notFound();
    }

    const { metadata, default: Content } = content;

    return (
      <>
        <BreadcrumbJsonLd
          locale={locale}
          name={metadata.title}
          description={metadata.description ?? ""}
          breadcrumbItems={headings.map((heading, index) => ({
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}${FILE_PATH}${heading.href}`,
            position: index + 1,
            name: heading.label,
            item: `https://nakafa.com/${locale}${FILE_PATH}${heading.href}`,
          }))}
        />
        <ArticleJsonLd
          headline={metadata.title}
          datePublished={formatISO(metadata.date)}
          author={metadata.authors.map((author) => ({
            "@type": "Person",
            name: author.name,
            url: `https://nakafa.com/${locale}/contributor`,
          }))}
          image={getOgUrl(locale, FILE_PATH)}
          description={metadata.description ?? ""}
        />
        <LearningResourceJsonLd
          name={metadata.title}
          description={metadata.description ?? ""}
          educationalLevel={t(category)}
          datePublished={formatISO(metadata.date)}
          author={metadata.authors.map((author) => ({
            "@type": "Person",
            name: author.name,
            url: `https://nakafa.com/${locale}/contributor`,
          }))}
        />
        <LayoutArticle onThisPage={headings}>
          <LayoutArticleHeader
            title={metadata.title}
            description={metadata.description}
            authors={metadata.authors}
            date={metadata.date}
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
              githubUrl={getGithubUrl({ path: `/contents${FILE_PATH}` })}
            />
          </LayoutArticleFooter>
        </LayoutArticle>
      </>
    );
  } catch {
    notFound();
  }
}
