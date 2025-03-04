import { Link } from "@/i18n/routing";
import type { Article } from "@/types/articles";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Badge } from "../ui/badge";
import { Card, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { GradientBlock } from "./gradient-block";

type Props = {
  category: string;
  article: Article;
};

export function CardArticle({ category, article }: Props) {
  const t = useTranslations("Articles");

  return (
    <Link
      key={article.slug}
      href={`/articles/${category}/${article.slug}`}
      className="group"
    >
      <Card className="relative h-full overflow-hidden pt-8">
        <GradientBlock
          keyString={article.slug}
          className="absolute inset-0 h-3 transition-all duration-500 ease-in-out group-hover:scale-200"
        />
        <CardHeader>
          <CardTitle
            title={article.title}
            className="line-clamp-2 font-medium tracking-tight"
          >
            {article.title}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex items-center justify-between">
          <time className="text-muted-foreground text-sm">
            {format(new Date(article.date), "d MMM, yyyy")}
          </time>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge>
                {article.official ? t("official") : t("contributor")}
              </Badge>
            </TooltipTrigger>

            <TooltipContent>
              <p>
                {article.official
                  ? t("official-description")
                  : t("contributor-description")}
              </p>
            </TooltipContent>
          </Tooltip>
        </CardFooter>
      </Card>
    </Link>
  );
}
