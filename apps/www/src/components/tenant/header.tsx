import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@repo/design-system/components/ui/breadcrumb";
import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHost } from "@/components/shared/breadcrumb/anchor";
import {
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";

/**
 * The one header of a school page, one row high: the sidebar's trigger, the page's path
 * from the school's home, and the page's actions at its end, the page's end-goal action
 * among them. The last item of the path is the page itself; on the school's home the path
 * is home alone, as the current page. The page's title is a heading that only assistive
 * technology reads, because the path already shows it; a page whose body draws its own
 * heading, such as the not-found page, passes no title. On a phone the path folds into
 * one menu beside the page's name, so the page's actions have their room. The shell
 * draws no header of its own.
 */
export function SchoolHeader({
  children,
  items,
  title,
}: {
  /** The page's actions, at the end of the row. */
  children?: ReactNode;
  /** The path after the school's home, the page itself last; empty on the home page. */
  items: readonly BreadcrumbHeaderItem[];
  /** The page's heading, unless the page's body draws its own. */
  title?: string;
}) {
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbHost host="school">
      <header
        className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4"
        data-slot="page-header"
      >
        <SidebarTrigger
          className="-ms-1 shrink-0"
          label={tCommon("toggle-sidebar")}
        />
        <Separator className="me-1 h-4" orientation="vertical" />
        {title === undefined ? null : <h1 className="sr-only">{title}</h1>}
        {Arr.isReadonlyArrayEmpty(items) ? (
          <Breadcrumb aria-label={tCommon("breadcrumb")} className="min-w-0">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{tCommon("home")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <BreadcrumbHeaderPath
            homeHref="/"
            homeLabel={tCommon("home")}
            items={Arr.map(items, (item, index) =>
              index === items.length - 1 ? { ...item, href: undefined } : item
            )}
            menuLabel={tCommon("more")}
          />
        )}
        {children === undefined ? null : (
          <div className="ms-auto flex shrink-0 items-center gap-2">
            {children}
          </div>
        )}
      </header>
    </BreadcrumbHost>
  );
}
