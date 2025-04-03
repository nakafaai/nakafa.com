import { LayoutArticle } from "@/components/shared/layout-article";
import { RefContent } from "@/components/shared/ref-content";
import { getHeadings, getRawContent } from "@/lib/utils/markdown";
import type { ContentMetadata } from "@/types/content";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { references } from "./ref";

const SLUG = "nepotism-in-political-governance";
const FILE_PATH = `/articles/politics/${SLUG}`;
const GITHUB_URL = `${process.env.GITHUB_URL}${FILE_PATH}`;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({
  params,
}: { params: Props["params"] }): Promise<Metadata> {
  const { locale } = await params;
  const metadata: ContentMetadata = await import(`./${locale}.mdx`).then(
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
  const { locale } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  try {
    // Get the file, headings
    const [file, headings] = await Promise.all([
      import(`./${locale}.mdx`),
      getRawContent(`${FILE_PATH}/${locale}.mdx`).then(getHeadings),
    ]);

    const Content = file.default;
    const metadata: ContentMetadata = file.metadata;

    return (
      <LayoutArticle
        metadata={metadata}
        content={<Content />}
        footer={
          <RefContent
            title={metadata.title}
            references={references}
            githubUrl={GITHUB_URL}
          />
        }
        onThisPage={headings}
      />
    );
  } catch {
    notFound();
  }
}
