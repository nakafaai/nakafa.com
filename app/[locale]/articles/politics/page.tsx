import { CardArticle } from "@/components/shared/card-article";
import { FooterContent } from "@/components/shared/footer-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/ui/icons";
import { Particles } from "@/components/ui/particles";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getArticles } from "@/lib/utils/markdown";
import { DramaIcon } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

const GITHUB_URL =
  "https://github.com/nabilfatih/nakafa.com/tree/main/app/%5Blocale%5D/articles/politics";

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
        <CardArticle key={article.slug} category="politics" article={article} />
      ))}
    </div>
  );
}

function RefContent() {
  const t = useTranslations("Common");

  return (
    <div className="space-y-4">
      <h2
        id={t("references")}
        className="scroll-mt-24 font-medium text-2xl leading-tight tracking-tight"
      >
        {t("references")}
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <GithubIcon className="size-4" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("source-code")}</p>
          </TooltipContent>
        </Tooltip>
      </div>
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
      <FooterContent className="mt-0">
        <RefContent />
      </FooterContent>
    </>
  );
}
