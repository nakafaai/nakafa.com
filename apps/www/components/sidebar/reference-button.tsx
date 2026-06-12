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
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { cleanupUrl, formatUrl } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

interface Props {
  references: Reference[];
  title: string;
}

/**
 * Renders the bibliography action inside the sidebar.
 */
export function ReferenceButton({ references, title }: Props) {
  const t = useTranslations("Common");
  const [open, { set, toggle }] = useDisclosure(false);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={toggle} tooltip={t("bibliography")}>
          <HugeIcons className="size-4 shrink-0" icon={LayerIcon} />
          <span className="truncate">{t("bibliography")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <Sheet modal={false} onOpenChange={set} open={open}>
        <SheetPopup className="w-full sm:max-w-xl">
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle className="text-xl">
                {references.length} {t("references")}
              </SheetTitle>
              <SheetDescription>{title}</SheetDescription>
            </SheetHeader>

            <Separator />

            <SheetPanel className="p-4">
              <Frame>
                {references.map((reference) => {
                  const url = reference.url
                    ? formatUrl(reference.url)
                    : t("no-website");
                  const cleanUrl = cleanupUrl(url).split("/")[0];

                  return (
                    <FramePanel className="p-0" key={reference.title}>
                      <FrameHeader>
                        <FrameTitle className="line-clamp-2 capitalize">
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
                            <span className="text-sm">{reference.details}</span>
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
    </>
  );
}
