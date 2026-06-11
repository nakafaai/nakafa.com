import type { Article } from "@repo/contents/_types/content";
import NavigationLink from "@repo/design-system/components/navigation/link";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { slugify } from "@repo/design-system/lib/utils";
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
    <NavigationLink
      className="group"
      href={`/articles/${category}/${article.slug}`}
      key={article.slug}
      title={article.title}
    >
      <FramePanel className="relative h-full overflow-hidden p-0">
        <div className="absolute inset-0 h-0 bg-primary transition-[height] duration-500 ease-out group-hover:h-4" />
        <FrameHeader>
          <FrameTitle className="line-clamp-2 font-medium leading-snug">
            <h2 className="scroll-mt-28" id={id} title={article.title}>
              {article.title}
            </h2>
          </FrameTitle>
        </FrameHeader>
        <FrameFooter className="flex items-center justify-between">
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

            <TooltipPopup>
              <p>
                {article.official
                  ? t("official-description")
                  : t("contributor-description")}
              </p>
            </TooltipPopup>
          </Tooltip>
        </FrameFooter>
      </FramePanel>
    </NavigationLink>
  );
}
