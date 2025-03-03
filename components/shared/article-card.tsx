import { Link } from "@/i18n/routing";
import type { Article } from "@/types/articles";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { GradientBlock } from "./gradient-block";

type Props = {
  category: string;
  article: Article;
};

export function ArticleCard({ category, article }: Props) {
  const t = useTranslations("Articles");

  return (
    <Link
      key={article.slug}
      href={`/articles/${category}/${article.slug}`}
      className="group relative"
    >
      <div className="relative h-[54px] w-full overflow-hidden rounded-xl shadow">
        <GradientBlock
          keyString={article.slug}
          className="absolute inset-0 transition-all duration-600 ease-in-out group-hover:scale-150"
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="absolute top-4 right-4">
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
      </div>
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
  );
}
