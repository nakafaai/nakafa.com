import type { DataPart } from "@repo/ai/types/data-parts";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
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
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowUpRightIcon,
  FrownIcon,
  Layers2Icon,
  SearchIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

const MAX_SHOWN_ARTICLES = 5;

type Props = {
  message: DataPart["get-articles"];
};

export const ArticlesPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  const [open, setOpen] = useState(false);

  const isLoading = message.status === "loading";
  const isError = message.status === "error";
  const articles = message.articles;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <SpinnerIcon className="size-4 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          {t("get-articles-loading")}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <FrownIcon className="size-4 shrink-0 text-destructive" />
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
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
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
          <NavigationLink
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            href={`/${article.slug}`}
            key={article.url}
            target="_blank"
          >
            {article.title}
            <ArrowUpRightIcon />
          </NavigationLink>
        ))}

        {articles.length > MAX_SHOWN_ARTICLES && (
          <Button onClick={() => setOpen(true)} size="sm" variant="outline">
            {t("view-all")}
            <Layers2Icon />
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
              <ScrollArea className="h-full px-4">
                <div className="my-4 flex flex-col divide-y overflow-hidden rounded-md border">
                  {articles.map((article) => (
                    <NavigationLink
                      className="group flex items-center gap-2 px-4 py-3 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                      href={`/${article.slug}`}
                      key={article.url}
                      target="_blank"
                    >
                      {article.title}
                      <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-accent-foreground" />
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
