"use client";

import { cleanupUrl, cn, formatUrl } from "@/lib/utils";
import type { Reference } from "@/types/content";
import {
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandYoutube,
} from "@tabler/icons-react";
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
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type Props = {
  /** The URL of the GitHub repository. */
  githubUrl: string;
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
          id={t("references")}
          className="scroll-mt-28 font-medium text-2xl leading-tight tracking-tight"
        >
          {t("references")}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {showSheet && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setOpen(!open)}
                  aria-label={t("bibliography")}
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
                variant="outline"
                size="icon"
                asChild
                aria-label={t("source-code")}
              >
                <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                  <span className="sr-only">{t("source-code")}</span>
                  <IconBrandGithub className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("source-code")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" asChild>
                <a
                  href="https://www.youtube.com/@nakafaa"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="sr-only">{t("videos")}</span>
                  <IconBrandYoutube className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("videos")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" asChild>
                <a
                  href="https://discord.gg/CPCSfKhvfQ"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="sr-only">{t("community")}</span>
                  <IconBrandDiscord className="size-4" />
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
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="w-6/7 sm:max-w-xl">
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="text-2xl">
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
                              title={reference.title}
                              className="line-clamp-1 capitalize"
                            >
                              {reference.title.toLowerCase()}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              <GlobeIcon className="size-4 shrink-0" />
                              {reference.url ? (
                                <a
                                  href={reference.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline-offset-4 hover:underline"
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
