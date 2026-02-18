import type { Article } from "@repo/contents/_types/content";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { slugify } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

interface Props {
  article: Article;
  category: string;
}

export function CardArticle({ category, article }: Props) {
  const t = useTranslations("Articles");

  const id = slugify(article.title);

  return (
    <Link
      className="group"
      href={`/articles/${category}/${article.slug}`}
      key={article.slug}
      prefetch
      title={article.title}
    >
      <Card className="relative h-full overflow-hidden">
        <div className="absolute inset-0 h-0 bg-primary transition-[height] duration-500 ease-out group-hover:h-4" />
        <CardHeader>
          <CardTitle className="line-clamp-2 font-medium leading-snug">
            <h2 className="scroll-mt-28" id={id} title={article.title}>
              {article.title}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex items-center justify-between">
          <time className="text-muted-foreground text-sm">
            {format(article.date, "d MMM, yyyy")}
          </time>
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="secondary">
                  {article.official ? t("official") : t("contributor")}
                </Badge>
              }
            />

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
