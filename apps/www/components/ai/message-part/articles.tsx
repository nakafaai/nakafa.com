import {
  ArrowUpRight01Icon,
  LayerIcon,
  News01Icon,
  Sad02Icon,
} from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/ai/schema/data-parts";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

const MAX_SHOWN_ARTICLES = 5;

interface Props {
  message: DataPart["get-articles"];
}

export const ArticlesPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  const [open, setOpen] = useState(false);

  const isLoading = message.status === "loading";
  const isError = message.status === "error";
  const articles = message.articles;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          {t("get-articles-loading")}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <HugeIcons className="size-4 text-destructive" icon={Sad02Icon} />
        <span className="text-muted-foreground text-sm">
          {t("get-articles-error")}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <HugeIcons
            className="size-4 text-muted-foreground"
            icon={News01Icon}
          />
          <span className="text-muted-foreground text-sm">
            {t("get-articles-title")}
          </span>
          <Badge variant="muted">{articles.length}</Badge>
        </div>
        <ArticlesPartPreview articles={articles} setOpen={setOpen} />
      </div>
      <ArticlesPartSheet
        articles={articles}
        input={message.input}
        open={open}
        setOpen={setOpen}
      />
    </>
  );
});

const ArticlesPartPreview = memo(
  ({
    articles,
    setOpen,
  }: {
    articles: DataPart["get-articles"]["articles"];
    setOpen: (open: boolean) => void;
  }) => {
    const t = useTranslations("Ai");

    if (articles.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {articles.slice(0, MAX_SHOWN_ARTICLES).map((article) => (
          <Button
            key={article.url}
            nativeButton={false}
            render={
              <a
                href={`/${article.slug}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {article.title}
                <HugeIcons icon={ArrowUpRight01Icon} />
              </a>
            }
            size="sm"
            variant="outline"
          />
        ))}

        {articles.length > MAX_SHOWN_ARTICLES && (
          <Button onClick={() => setOpen(true)} size="sm" variant="outline">
            {t("view-all")}
            <HugeIcons icon={LayerIcon} />
          </Button>
        )}
      </div>
    );
  }
);
ArticlesPartPreview.displayName = "ArticlesPartPreview";

const ArticlesPartSheet = memo(
  ({
    input,
    articles,
    open,
    setOpen,
  }: {
    input: DataPart["get-articles"]["input"];
    articles: DataPart["get-articles"]["articles"];
    open: boolean;
    setOpen: (open: boolean) => void;
  }) => {
    const t = useTranslations("Ai");
    const tArticles = useTranslations("Articles");

    return (
      <Sheet modal={false} onOpenChange={setOpen} open={open}>
        <SheetContent className="w-full sm:max-w-xl">
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle className="text-xl">
                {articles.length} {t("get-articles-title")}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="muted">{tArticles(input.category)}</Badge>
              </SheetDescription>
            </SheetHeader>

            <Separator />

            <div className="flex flex-1 flex-col overflow-hidden">
              <ScrollArea className="h-full">
                <div className="flex flex-col divide-y overflow-hidden">
                  {articles.map((article) => (
                    <NavigationLink
                      className="group flex items-center gap-2 px-4 py-3 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                      href={`/${article.slug}`}
                      key={article.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {article.title}
                      <HugeIcons
                        className="size-4 text-muted-foreground opacity-0 transition-opacity ease-out group-hover:text-accent-foreground group-hover:opacity-100"
                        icon={ArrowUpRight01Icon}
                      />
                    </NavigationLink>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);
ArticlesPartSheet.displayName = "ArticlesPartSheet";
