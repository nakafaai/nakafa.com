"use client";

import {
  Book03Icon,
  BookOpen02Icon,
  Calendar03Icon,
  DiscordIcon,
  GithubIcon,
  Globe02Icon,
  LayerIcon,
  QuillWrite01Icon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { Reference } from "@repo/contents/_types/content";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cleanupUrl, cn, formatUrl } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

interface Props {
  /** The className of the references. */
  className?: string;
  /** The URL of the GitHub repository. */
  githubUrl?: string;
  /** The references to display (sheet content) */
  references?: Reference[];
  /** The title of the references (sheet title) */
  title?: string;
}

/**
 * Renders reference actions for learn pages.
 */
export function RefContent({ title, references, githubUrl, className }: Props) {
  const t = useTranslations("Common");
  const [open, { set, toggle }] = useDisclosure(false);
  const referenceList = references ?? [];
  const showSheet = Boolean(referenceList.length && title);

  return (
    <>
      <section
        aria-labelledby={t("references")}
        className={cn("space-y-4", className)}
      >
        <h2
          className="scroll-mt-28 font-medium text-2xl leading-tight tracking-tight"
          id={t("references")}
        >
          {t("references")}
        </h2>

        <nav
          aria-label="Reference actions"
          className="flex flex-wrap items-center gap-2"
        >
          {showSheet ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t("bibliography")}
                    onClick={toggle}
                    size="icon"
                    variant="outline"
                  >
                    <span className="sr-only">{t("bibliography")}</span>
                    <HugeIcons className="size-4" icon={LayerIcon} />
                  </Button>
                }
              />
              <TooltipPopup side="bottom">
                <p>{t("bibliography")}</p>
              </TooltipPopup>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("source-code")}
                  render={
                    <a
                      href={
                        githubUrl ?? "https://github.com/nakafaai/nakafa.com"
                      }
                      rel="noopener noreferrer"
                      target="_blank"
                      title={t("source-code")}
                    >
                      <span className="sr-only">{t("source-code")}</span>
                      <HugeIcons className="size-4" icon={GithubIcon} />
                    </a>
                  }
                  size="icon"
                  variant="outline"
                />
              }
            />
            <TooltipPopup side="bottom">
              <p>{t("source-code")}</p>
            </TooltipPopup>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  render={
                    <a
                      href="https://www.youtube.com/@nakafaa"
                      rel="noopener noreferrer"
                      target="_blank"
                      title={t("videos")}
                    >
                      <span className="sr-only">{t("videos")}</span>
                      <HugeIcons className="size-4" icon={YoutubeIcon} />
                    </a>
                  }
                  size="icon"
                  variant="outline"
                />
              }
            />
            <TooltipPopup side="bottom">
              <p>{t("videos")}</p>
            </TooltipPopup>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  render={
                    <a
                      href="https://discord.gg/CPCSfKhvfQ"
                      rel="noopener noreferrer"
                      target="_blank"
                      title={t("community")}
                    >
                      <span className="sr-only">{t("community")}</span>
                      <HugeIcons className="size-4" icon={DiscordIcon} />
                    </a>
                  }
                  size="icon"
                  variant="outline"
                />
              }
            />
            <TooltipPopup side="bottom">
              <p>{t("community")}</p>
            </TooltipPopup>
          </Tooltip>
        </nav>
      </section>

      {showSheet ? (
        <Sheet modal={false} onOpenChange={set} open={open}>
          <SheetPopup className="w-full sm:max-w-xl">
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="text-xl">
                  {referenceList.length} {t("references")}
                </SheetTitle>
                <SheetDescription>{title}</SheetDescription>
              </SheetHeader>

              <Separator />

              <SheetPanel className="p-4">
                <Frame>
                  {referenceList.map((reference) => {
                    const url = reference.url
                      ? formatUrl(reference.url)
                      : t("no-website");
                    const cleanUrl = cleanupUrl(url).split("/")[0];

                    return (
                      <FramePanel className="p-0" key={reference.title}>
                        <FrameHeader>
                          <FrameTitle
                            className="line-clamp-1 capitalize"
                            title={reference.title}
                          >
                            {reference.title.toLowerCase()}
                          </FrameTitle>
                          <FrameDescription className="flex items-center gap-1">
                            <HugeIcons
                              className="size-4 shrink-0"
                              icon={Globe02Icon}
                            />
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
                          </FrameDescription>
                        </FrameHeader>

                        <div className="space-y-2 px-5 pb-5">
                          <div className="flex items-center gap-1">
                            <HugeIcons
                              className="size-4 shrink-0"
                              icon={QuillWrite01Icon}
                            />
                            <span className="line-clamp-1 text-sm">
                              {reference.authors}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <HugeIcons
                              className="size-4 shrink-0"
                              icon={Calendar03Icon}
                            />
                            <span className="text-sm">{reference.year}</span>
                          </div>

                          {!!reference.publication && (
                            <div className="flex items-center gap-1">
                              <HugeIcons
                                className="size-4 shrink-0"
                                icon={BookOpen02Icon}
                              />
                              <span className="line-clamp-1 text-sm">
                                {reference.publication}
                              </span>
                            </div>
                          )}

                          {!!reference.details && (
                            <div className="flex items-center gap-1">
                              <HugeIcons
                                className="size-4 shrink-0"
                                icon={Book03Icon}
                              />
                              <span className="text-sm">
                                {reference.details}
                              </span>
                            </div>
                          )}
                        </div>
                      </FramePanel>
                    );
                  })}
                </Frame>
              </SheetPanel>
            </div>
          </SheetPopup>
        </Sheet>
      ) : null}
    </>
  );
}
