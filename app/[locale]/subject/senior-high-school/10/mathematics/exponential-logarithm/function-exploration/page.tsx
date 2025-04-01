import { LayoutMaterial } from "@/components/shared/layout-material";
import { getHeadings } from "@/lib/utils/markdown";
import { getRawContent } from "@/lib/utils/markdown";
import type { ContentMetadata } from "@/types/content";
import { PiIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

const SLUG = "function-exploration";
const SLUG_SUBJECT = "exponential-logarithm";
const BASE_PATH = "/subject/senior-high-school/10/mathematics";
const FILE_PATH = `${BASE_PATH}/${SLUG_SUBJECT}/${SLUG}`;
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
    title: `${metadata.title} - ${metadata.subject}`,
    alternates: metadata.alternates,
    authors: metadata.authors,
    category: metadata.category,
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Common");

  // Enable static rendering
  setRequestLocale(locale);

  try {
    const file = await import(`./${locale}.mdx`);
    const Content = file.default;

    // import metadata from the mdx file based on the locale
    const metadata: ContentMetadata = file.metadata;

    // Read the raw file content
    const rawContent = await getRawContent(`${FILE_PATH}/${locale}.mdx`);

    // Extract headings from the raw content
    const headings = getHeadings(rawContent);

    return (
      <LayoutMaterial
        header={{
          title: metadata.title,
          link: {
            href: `/${BASE_PATH}#${metadata.subject?.toLowerCase().replace(/\s+/g, "-")}`,
            label: metadata.subject ?? "",
          },
        }}
        category={{
          icon: PiIcon,
          name: metadata.category ?? "",
        }}
        metadata={metadata}
        content={<Content />}
        chapters={{
          label: t("on-this-page"),
          data: headings,
        }}
        footerClassName="mt-10"
        githubUrl={GITHUB_URL}
      />
    );
  } catch {
    notFound();
  }
}
