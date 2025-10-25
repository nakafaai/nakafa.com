"use client";

import { SiDiscord, SiGithub, SiYoutube } from "@icons-pack/react-simple-icons";
import type { Reference } from "@repo/contents/_types/content";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cleanupUrl, cn, formatUrl } from "@repo/design-system/lib/utils";
import {
  BookIcon,
  BookOpenIcon,
  CalendarIcon,
  GlobeIcon,
  LayersIcon,
  PencilIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  /** The URL of the GitHub repository. */
  githubUrl?: string;
  /** The title of the references (sheet title) */
  title?: string;
  /** The references to display (sheet content) */
  references?: Reference[];
  /** The className of the references. */
  className?: string;
};

export function RefContent({ title, references, githubUrl, className }: Props) {
  const t = useTranslations("Common");

  const [open, setOpen] = useState<boolean>(false);

  const showSheet = references && title;

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <h2
          className="scroll-mt-28 font-medium text-2xl leading-tight tracking-tight"
          id={t("references")}
        >
          {t("references")}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {showSheet && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={t("bibliography")}
                  onClick={() => setOpen(!open)}
                  size="icon"
                  variant="outline"
                >
                  <span className="sr-only">{t("bibliography")}</span>
                  <LayersIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{t("bibliography")}</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("source-code")}
                asChild
                size="icon"
                variant="outline"
              >
                <a
                  href={githubUrl ?? "https://github.com/nakafaai/nakafa.com"}
                  rel="noopener noreferrer"
                  target="_blank"
                  title={t("source-code")}
                >
                  <span className="sr-only">{t("source-code")}</span>
                  <SiGithub className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("source-code")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild size="icon" variant="outline">
                <a
                  href="https://www.youtube.com/@nakafaa"
                  rel="noopener noreferrer"
                  target="_blank"
                  title={t("videos")}
                >
                  <span className="sr-only">{t("videos")}</span>
                  <SiYoutube className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("videos")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild size="icon" variant="outline">
                <a
                  href="https://discord.gg/CPCSfKhvfQ"
                  rel="noopener noreferrer"
                  target="_blank"
                  title={t("community")}
                >
                  <span className="sr-only">{t("community")}</span>
                  <SiDiscord className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("community")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {showSheet && (
        <Sheet modal={false} onOpenChange={setOpen} open={open}>
          <SheetContent className="w-full sm:max-w-xl">
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="text-xl">
                  {references.length} {t("references")}
                </SheetTitle>
                <SheetDescription>{title}</SheetDescription>
              </SheetHeader>

              <Separator />

              <div className="flex flex-1 flex-col overflow-hidden">
                <ScrollArea className="h-full px-4">
                  <div className="flex flex-col gap-4 py-4">
                    {references.map((reference) => {
                      const url = reference.url
                        ? formatUrl(reference.url)
                        : t("no-website");
                      const cleanUrl = cleanupUrl(url).split("/")[0];

                      return (
                        <Card key={reference.title}>
                          <CardHeader>
                            <CardTitle
                              className="line-clamp-1 capitalize"
                              title={reference.title}
                            >
                              {reference.title.toLowerCase()}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              <GlobeIcon className="size-4 shrink-0" />
                              {reference.url ? (
                                <a
                                  className="underline-offset-4 hover:underline"
                                  href={reference.url}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {cleanUrl}
                                </a>
                              ) : (
                                <span>{t("no-website")}</span>
                              )}
                            </CardDescription>
                          </CardHeader>

                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-1">
                              <PencilIcon className="size-4 shrink-0" />
                              <span className="line-clamp-1 text-sm">
                                {reference.authors}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <CalendarIcon className="size-4 shrink-0" />
                              <span className="text-sm">{reference.year}</span>
                            </div>

                            {reference.publication && (
                              <div className="flex items-center gap-1">
                                <BookOpenIcon className="size-4 shrink-0" />
                                <span className="line-clamp-1 text-sm">
                                  {reference.publication}
                                </span>
                              </div>
                            )}

                            {reference.details && (
                              <div className="flex items-center gap-1">
                                <BookIcon className="size-4 shrink-0" />
                                <span className="text-sm">
                                  {reference.details}
                                </span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
