"use client";

import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BreadcrumbHost } from "@/components/shared/breadcrumb/anchor";
import {
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";

/**
 * The one header of a school page, one row high: the sidebar's trigger, the page's path
 * from the school's home, and the page's actions at its end, the page's one primary button
 * among them. The last item of the path is the page itself, and its title is a heading that
 * only assistive technology reads, because the path already shows it. The shell draws no
 * header of its own.
 */
export function SchoolHeader({
  children,
  items,
  title,
}: {
  /** The page's actions, at the end of the row. */
  children?: ReactNode;
  /** The path after the school's home, the page itself last. */
  items: readonly BreadcrumbHeaderItem[];
  title: string;
}) {
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbHost host="school">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ms-1 shrink-0" />
        <Separator className="me-1 h-4" orientation="vertical" />
        <h1 className="sr-only">{title}</h1>
        <BreadcrumbHeaderPath
          homeHref="/"
          homeLabel={tCommon("home")}
          items={Arr.map(items, (item, index) =>
            index === items.length - 1 ? { ...item, href: undefined } : item
          )}
          menuLabel={tCommon("more")}
        />
        {children === undefined ? null : (
          <div className="ms-auto flex shrink-0 items-center gap-2">
            {children}
          </div>
        )}
      </header>
    </BreadcrumbHost>
  );
}
