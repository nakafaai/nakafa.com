import { SidebarScopeStart } from "@repo/design-system/components/ui/sidebar-scope";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { pageHeaderRowVariants } from "@/components/shared/page/width";
import { ShellTitle } from "@/components/sidebar/lock";

/**
 * The words of a control in a page's header. They fold first, leaving the icon and the name for assistive
 * technology, so the row keeps its path whole. The row's own width decides, whatever the sidebar leaves it.
 */
export function PageHeaderLabel({ children }: { children: ReactNode }) {
  return <span className="@max-2xl/header:sr-only">{children}</span>;
}

/**
 * The one header of every page of the app and of School, one row high: the sidebar's trigger on a phone, the page's
 * path or title, an optional centre (`PageCenter`) and the page's actions (`PageActions`). The bar and its border run
 * the screen's full width, and its row is one row of the page, so the path and the actions stand on the edges of the
 * body under it at every width. It is sticky and one control high from the first paint, so actions that arrive later
 * move nothing. A page whose path already shows its name passes `title`, which only assistive technology reads; a page
 * whose body draws its own heading passes none.
 *
 * The trigger is the app's or the school's sidebar, whichever scope the shell keeps; a page that locks the shell, such
 * as a running attempt, and a page outside a shell, such as the exam editor, draw none. On a desktop the sidebar sits
 * beside the page, and the row is the page's alone. A row with a centre (`PageCenter`) or a visible title in the middle
 * (`PageTitle`) lays itself out in three zones, the start and the end equal, so the middle stays in the middle whatever
 * the start says; on a phone a title takes the room the path and the actions leave. Text at twice its size leaves one line no room, so the
 * actions then take a line of their own.
 */
export function PageHeader({
  children,
  title,
}: {
  children: ReactNode;
  /** The page's heading, unless the page's body draws its own. */
  title?: string;
}) {
  const tCommon = useTranslations("Common");

  return (
    <header
      className="bg-background @container/bar sticky top-[var(--app-header-top,4rem)] z-20 flex min-h-16 w-full shrink-0 items-center border-b lg:top-0"
      data-slot="page-header"
    >
      <ShellTitle />
      <div className={pageHeaderRowVariants()}>
        <div className="[display:var(--app-shell-locked,contents)]">
          <SidebarScopeStart
            className="group-data-locked/sidebar-wrapper:hidden lg:hidden"
            label={tCommon("toggle-sidebar")}
          />
        </div>
        {title === undefined ? null : (
          <h1 className="sr-only" dir="auto">
            {title}
          </h1>
        )}
        <div className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 py-2 has-data-[slot=page-center]:grid has-data-[slot=page-center]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] has-data-[slot=page-title]:grid has-data-[slot=page-title]:grid-cols-[auto_minmax(0,1fr)_auto] md:has-data-[slot=page-title]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:has-data-[slot=page-title]:gap-x-4 @max-3xs/bar:flex-wrap">
          {children}
        </div>
      </div>
    </header>
  );
}

/** The centre of a page's header, such as an attempt's timer, which stays in the middle of the row. */
export function PageCenter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center" data-slot="page-center">
      {children}
    </div>
  );
}

/**
 * The page's name in the middle of its header, as a try-out's title: on a phone it takes the room the path and the
 * actions leave, and from a tablet it stands centred, as wide as a column at most. `title` is its whole text, which a
 * cut name shows on hover.
 */
export function PageTitle({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <h1
      className="min-w-0 truncate text-base font-medium md:max-w-xs md:text-center"
      data-slot="page-title"
      title={title}
    >
      {children}
    </h1>
  );
}

/**
 * The page's actions at the end of its header, its one primary action among them. A header holds at most two controls,
 * a button group counting as one, so more go into a group.
 */
export function PageActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="col-start-3 ms-auto flex shrink-0 items-center justify-end gap-2"
      data-slot="page-actions"
    >
      {children}
    </div>
  );
}
