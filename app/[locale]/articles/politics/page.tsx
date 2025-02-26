import path from "node:path";
import { LayoutContent } from "@/components/shared/layout-content";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Particles } from "@/components/ui/particles";
import { Link } from "@/i18n/routing";
import { getArticles } from "@/lib/utils/markdown";
import { format } from "date-fns";
import { CalendarIcon, DramaIcon } from "lucide-react";
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

export default async function PoliticsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Articles");

  // Enable static rendering
  setRequestLocale(locale);

  // Dynamically get all article directories
  const basePath = path.join(
    process.cwd(),
    "app",
    "[locale]",
    "articles",
    "politics"
  );
  const articles = await getArticles(basePath, locale);

  return (
    <>
      <div className="relative border-b py-10">
        <Particles className="pointer-events-none absolute inset-0 opacity-50" />
        <div className="z-10 mx-auto max-w-4xl space-y-2 px-4">
          <div className="flex items-center gap-2">
            <DramaIcon className="size-6" />
            <h1 className="font-medium text-3xl leading-tight tracking-tight">
              {t("politics")}
            </h1>
          </div>
          <p className="text-foreground/80">{t("description")}</p>
        </div>
      </div>
      <LayoutContent className="max-w-4xl py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {articles.map((article) => (
            <Link
              href={`/articles/politics/${article.slug}`}
              key={article.slug}
            >
              <Card className="hover:primary/10 transition-colors hover:border-primary/20">
                <CardHeader>
                  <CardTitle title={article.title} className="line-clamp-2">
                    {article.title}
                  </CardTitle>
                  <CardDescription
                    title={article.description}
                    className="truncate"
                  >
                    {article.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="size-4 shrink-0" />
                    <span className="line-clamp-1 text-sm">
                      {format(new Date(article.date), "d MMM, yyyy")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </LayoutContent>
    </>
  );
}
