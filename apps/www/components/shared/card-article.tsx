import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { slugify } from "@repo/design-system/lib/routing/slug";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import type { PublishedArticleSummary } from "@/lib/content/articles";

interface Props {
  article: PublishedArticleSummary;
}

/** Renders one active published article summary as a localized card link. */
export function CardArticle({ article }: Props) {
  const t = useTranslations("Articles");

  const id = slugify(article.title);

  return (
    <NavigationLink
      className="group"
      href={`/${article.publicPath}`}
      key={article.slug}
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
    </NavigationLink>
  );
}
