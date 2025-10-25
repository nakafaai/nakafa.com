"use client";

import type { Reference } from "@repo/contents/_types/content";
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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { cleanupUrl, formatUrl } from "@repo/design-system/lib/utils";
import {
  BookIcon,
  BookOpenIcon,
  CalendarIcon,
  GlobeIcon,
  Layers2Icon,
  PencilIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  references: Reference[];
  title: string;
};

export function ReferenceButton({ references, title }: Props) {
  const t = useTranslations("Common");

  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => setOpen(!open)}
          tooltip={t("bibliography")}
        >
          <Layers2Icon className="size-4 shrink-0" />
          <span className="truncate">{t("bibliography")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

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
                            className="line-clamp-2 capitalize"
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
    </>
  );
}
