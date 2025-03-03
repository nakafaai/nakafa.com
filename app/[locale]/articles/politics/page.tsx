import { ArticleCard } from "@/components/shared/article-card";
import { LayoutContent } from "@/components/shared/layout-content";
import { Particles } from "@/components/ui/particles";
import { getArticles } from "@/lib/utils/markdown";
import { DramaIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Articles");

  return {
    title: t("politics"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/articles/politics`,
    },
  };
}

async function ArticleList({ locale }: { locale: string }) {
  // Statically get all articles
  const articles = await getArticles("app/[locale]/articles/politics", locale);

  return (
    <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
      {articles.map((article) => (
        <ArticleCard key={article.slug} category="politics" article={article} />
      ))}
    </div>
  );
}

export default async function PoliticsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Articles");

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <div className="relative border-b py-10">
        <Particles className="pointer-events-none absolute inset-0 opacity-50" />
        <div className="z-10 mx-auto max-w-3xl space-y-2 px-4">
          <div className="flex items-center gap-2">
            <DramaIcon className="size-6" />
            <h1 className="font-medium text-3xl leading-tight tracking-tight">
              {t("politics")}
            </h1>
          </div>
          <p className="text-foreground/80">{t("description")}</p>
        </div>
      </div>
      <LayoutContent className="py-10">
        <ArticleList locale={locale} />
      </LayoutContent>
    </>
  );
}
