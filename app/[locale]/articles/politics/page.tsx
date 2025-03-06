import { CardArticle } from "@/components/shared/card-article";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderList } from "@/components/shared/header-list";
import { LayoutContent } from "@/components/shared/layout-content";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/ui/icons";
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

const FILE_PATH = "app/[locale]/articles/politics";
const GITHUB_URL = `https://github.com/nabilfatih/nakafa.com/tree/main/${FILE_PATH}`;

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
  const articles = await getArticles(FILE_PATH, locale);

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
      <HeaderList
        title={t("politics")}
        description={t("description")}
        icon={DramaIcon}
      />
      <LayoutContent className="py-10">
        <ArticleList locale={locale} />
      </LayoutContent>
      <FooterContent className="mt-0">
        <RefContent />
      </FooterContent>
    </>
  );
}
