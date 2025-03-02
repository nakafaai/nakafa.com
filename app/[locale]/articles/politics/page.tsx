import { GradientBlock } from "@/components/shared/gradient-block";
import { LayoutContent } from "@/components/shared/layout-content";
import { Badge } from "@/components/ui/badge";
import { Particles } from "@/components/ui/particles";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@/i18n/routing";
import { getArticles } from "@/lib/utils/markdown";
import { format } from "date-fns";
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
  const t = await getTranslations("Articles");
  // Statically get all articles
  const articles = await getArticles("app/[locale]/articles/politics", locale);

  return (
    <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
      {articles.map((article) => (
        <Link
          key={article.slug}
          href={`/articles/politics/${article.slug}`}
          className="group relative"
        >
          <GradientBlock
            keyString={article.slug}
            colorScheme="vibrant"
            intensity="soft"
            className="h-48 w-full rounded-xl border opacity-80 shadow transition-all duration-300 group-hover:rounded-3xl group-hover:opacity-100"
          />
          {article.official && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="absolute top-4 right-4">
                  {t("official")}
                </Badge>
              </TooltipTrigger>

              <TooltipContent side="bottom">
                <p>{t("official-description")}</p>
              </TooltipContent>
            </Tooltip>
          )}

          <div className="relative mt-2 grid gap-1.5 break-words">
            <h2
              title={article.title}
              className="line-clamp-2 font-medium text-lg leading-tight tracking-tight"
            >
              {article.title}
            </h2>
            <div className="flex items-center justify-between">
              <p className="line-clamp-1 text-muted-foreground text-sm leading-none tracking-tight">
                {format(new Date(article.date), "d MMM, yyyy")}
              </p>
            </div>
          </div>
        </Link>
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
