import {
  LayoutArticle,
  LayoutArticleContent,
  LayoutArticleFooter,
  LayoutArticleHeader,
} from "@/components/shared/layout-article";
import { RefContent } from "@/components/shared/ref-content";
import { getCategoryIcon } from "@/lib/utils/articles/category";
import { getContent } from "@/lib/utils/contents";
import { getReferences } from "@/lib/utils/contents";
import { getGithubUrl } from "@/lib/utils/github";
import { getHeadings, getRawContent } from "@/lib/utils/markdown";
import { getFolderChildNames } from "@/lib/utils/system";
import type { ArticleCategory } from "@/types/articles/category";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: Locale; category: ArticleCategory; slug: string }>;
};

// Generate bottom-up static params
export function generateStaticParams() {
  const basePath = "contents/articles";
  const categories = getFolderChildNames(basePath);

  const params: { category: string; slug: string }[] = [];

  for (const category of categories) {
    const slugs = getFolderChildNames(`${basePath}/${category}`);
    for (const slug of slugs) {
      params.push({ category, slug });
    }
  }

  return params;
}

export default async function Page({ params }: Props) {
  const { locale, category, slug } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  const FILE_PATH = `/articles/${category}/${slug}`;

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
          icon={getCategoryIcon(category)}
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
