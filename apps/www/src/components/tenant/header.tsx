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
import {
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";
import { useTenant } from "@/components/tenant/context";
import { schoolHomeTarget } from "@/lib/routing/school/target";

/**
 * The one header of a school page, one row high: the sidebar's trigger, the page's path
 * from the school's home, and the page's actions at its end, the page's end-goal action
 * among them. The last item of the path is the page itself. A page whose heading is its
 * own, such as the school's home with its greeting, passes that heading in place of the
 * path, and the heading is then the page's h1. A page whose title is the path's last item
 * passes its title, which only assistive technology reads, because the path already shows
 * it; a page whose body draws its own heading, such as the not-found page, passes no title.
 * On a phone the path folds into one menu beside the page's name, so the page's actions
 * have their room. The shell draws no header of its own.
 */
export function SchoolHeader({
  children,
  heading,
  items,
  title,
}: {
  /** The page's actions, at the end of the row. */
  children?: ReactNode;
  /** The page's own heading at the start of the row, in place of the path, such as the school's greeting. */
  heading?: ReactNode;
  /** The path after the school's home, the page itself last; empty on the school's home. */
  items: readonly BreadcrumbHeaderItem[];
  /** The page's heading, unless the page's body draws its own. */
  title?: string;
}) {
  const tCommon = useTranslations("Common");

  return (
    <header
      className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4"
      data-slot="page-header"
    >
      <SidebarTrigger
        className="-ms-1 shrink-0"
        label={tCommon("toggle-sidebar")}
      />
      <Separator className="me-1 h-4" orientation="vertical" />
      {title === undefined ? null : (
        <h1 className="sr-only" dir="auto">
          {title}
        </h1>
      )}
      {heading === undefined ? <SchoolPath items={items} /> : heading}
      {children === undefined ? null : (
        <div className="ms-auto flex shrink-0 items-center gap-2">
          {children}
        </div>
      )}
    </header>
  );
}

/**
 * The path of a school page after its home, with the page itself last. On the school's
 * home the path is home alone, as the current page.
 */
function SchoolPath({
  items,
}: {
  /** The path after the school's home, the page itself last; empty on the school's home. */
  items: readonly BreadcrumbHeaderItem[];
}) {
  const { slug } = useTenant();
  const tCommon = useTranslations("Common");

  if (Arr.isReadonlyArrayEmpty(items)) {
    return (
      <Breadcrumb aria-label={tCommon("breadcrumb")} className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{tCommon("home")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }
  return (
    <BreadcrumbHeaderPath
      home={schoolHomeTarget(slug)}
      homeLabel={tCommon("home")}
      items={Arr.map(items, (item, index) =>
        index === items.length - 1 ? { ...item, target: undefined } : item
      )}
      menuLabel={tCommon("more")}
    />
  );
}
