"use client";

import {
  Book03Icon,
  BookOpen02Icon,
  Calendar03Icon,
  Globe02Icon,
  LayerIcon,
  QuillWrite01Icon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { Reference } from "@repo/contents/_types/content";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { cleanupUrl, formatUrl } from "@repo/design-system/lib/routing/url";
import { useTranslations } from "next-intl";
import { useLayoutEffect } from "react";

interface Props {
  references: Reference[];
  title: string;
}

/**
 * Renders the bibliography action inside the sidebar.
 *
 * The sheet is transient UI, so it resets closed when Next hides the page
 * through Cache Components state preservation.
 *
 * References:
 * - Next.js preserving UI state with Cache Components:
 *   `apps/www/node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
 * - Mantine `useDisclosure`:
 *   https://mantine.dev/hooks/use-disclosure/
 */
export function ReferenceButton({ references, title }: Props) {
  const t = useTranslations("Common");
  const [open, { close, set, toggle }] = useDisclosure(false);

  useLayoutEffect(() => close, [close]);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={toggle} tooltip={t("bibliography")}>
          <HugeIcons className="size-4 shrink-0" icon={LayerIcon} />
          <span className="truncate">{t("bibliography")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <Sheet modal={false} onOpenChange={set} open={open}>
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
              <ScrollArea className="h-full">
                <ul data-slot="reference-list">
                  {references.map((reference, index) => {
                    const url = reference.url
                      ? formatUrl(reference.url)
                      : t("no-website");
                    const cleanUrl = cleanupUrl(url).split("/")[0];

                    return (
                      <li
                        className="pt-4 last:pb-4"
                        data-slot="reference-item"
                        key={reference.title}
                      >
                        <div
                          className="flex flex-col gap-4 px-4"
                          data-slot="reference-item-content"
                        >
                          <div className="flex flex-col gap-1">
                            <h3
                              className="line-clamp-2 font-medium text-sm capitalize leading-normal"
                              title={reference.title}
                            >
                              {reference.title.toLowerCase()}
                            </h3>
                            <div className="flex items-center gap-1 text-muted-foreground text-sm">
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
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
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
                        </div>

                        {index < references.length - 1 && (
                          <Separator className="mt-4" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
