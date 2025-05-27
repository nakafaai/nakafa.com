import { Link } from "@/i18n/navigation";
import { slugify } from "@/lib/utils";
import type { Article } from "@/types/content";
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

  const id = slugify(article.title);

  return (
    <Link
      key={article.slug}
      href={`/articles/${category}/${article.slug}`}
      title={article.title}
      className="group"
      prefetch
    >
      <Card className="relative h-full overflow-hidden pt-8">
        <GradientBlock
          keyString={article.slug}
          className="absolute inset-0 h-3 border-b transition-all duration-500 ease-in-out group-hover:h-5"
        />
        <CardHeader>
          <CardTitle className="line-clamp-2 font-medium leading-snug">
            <h2 id={id} title={article.title} className="scroll-mt-28">
              {article.title}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex items-center justify-between">
          <time className="text-muted-foreground text-sm">
            {format(article.date, "d MMM, yyyy")}
          </time>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline">
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
