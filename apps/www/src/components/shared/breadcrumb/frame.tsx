import { SidebarScopeStart } from "@repo/design-system/components/ui/sidebar-scope";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { pageRowVariants } from "@/components/shared/content/width";
import { ShellTitle } from "@/components/sidebar/lock";

/**
 * The words of a control in a page's header. They fold first, leaving the icon and the name for assistive
 * technology, so the row keeps its path whole. The row's own width decides, whatever the sidebar leaves it.
 */
export function HeaderLabel({ children }: { children: ReactNode }) {
  return <span className="@max-2xl/header:sr-only">{children}</span>;
}

/**
 * The one header of a page; each route owns its path and actions. Below the desktop
 * breakpoint it also holds the trigger of the app's sidebar, so a phone shows one
 * header row, and the app shell hides its own bar while a page shows this one. A page
 * that locks the shell, such as a running attempt, hides the trigger from its first
 * paint, as the shell hides its own bar, so nothing shifts when the lock applies. On a
 * desktop the sidebar sits beside the page, and the row is the page's alone. The row is one
 * row of the page (`pageRowVariants`), so it stands on the edges of the body under it.
 */
export function BreadcrumbHeaderFrame({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const tCommon = useTranslations("Common");

  return (
    <header
      className={cn(
        "bg-background sticky top-[var(--app-header-top,4rem)] z-10 flex min-h-16 w-full shrink-0 items-center border-b lg:top-0",
        className
      )}
      data-slot="page-header"
    >
      <ShellTitle />
      <div
        className={cn(
          pageRowVariants(),
          "@container/header flex min-w-0 items-center gap-1"
        )}
      >
        <SidebarScopeStart
          className="-ms-2 group-has-[[data-shell-lock]]/sidebar-wrapper:hidden group-data-locked/sidebar-wrapper:hidden lg:hidden"
          label={tCommon("toggle-sidebar")}
        />
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center justify-between gap-3 py-3",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </header>
  );
}
