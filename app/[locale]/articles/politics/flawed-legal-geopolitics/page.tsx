import fs from "node:fs/promises";
import { LayoutArticle } from "@/components/shared/layout-article";
import { RefContent } from "@/components/shared/ref-content";
import type { Locale } from "@/i18n/routing";
import { getHeadings } from "@/lib/utils/markdown";
import type { ArticleMetadata } from "@/types/articles";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { references } from "./ref";

const githubUrl =
  "https://github.com/nabilfatih/nakafa.com/tree/main/app/%5Blocale%5D/articles/politics/flawed-legal-geopolitics";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: { params: Props["params"] }): Promise<Metadata> {
  const { locale } = await params;
  const metadata: ArticleMetadata = await import(`./${locale}.mdx`).then(
    (m) => m.metadata
  );

  return {
    title: metadata.title,
    description: metadata.description,
    alternates: metadata.alternates,
    authors: metadata.authors,
    category: metadata.category,
  };
}

export default async function Page({ params }: Props) {
  const locale = (await params).locale as Locale;

  // Enable static rendering
  setRequestLocale(locale);

  try {
    const file = await import(`./${locale}.mdx`);
    const Content = file.default;

    // import metadata from the mdx file based on the locale
    const metadata: ArticleMetadata = file.metadata;

    // Read the raw file content
    // we need to use the full path to the MDX file
    const rawContent = await fs
      .readFile(
        `app/[locale]/articles/politics/flawed-legal-geopolitics/${locale}.mdx`,
        "utf-8"
      )
      .catch(() => {
        return "";
      });

    // Extract headings from the raw content
    const headings = getHeadings(rawContent).map((heading) => ({
      label: heading,
      href: `#${heading}`,
    }));

    return (
      <LayoutArticle
        metadata={metadata}
        content={<Content />}
        footer={
          <RefContent
            title={metadata.title}
            references={references}
            githubUrl={githubUrl}
          />
        }
        onThisPage={headings}
      />
    );
  } catch {
    notFound();
  }
}
