import { SidebarScopeStart } from "@repo/design-system/components/ui/sidebar-scope";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { ShellTitle } from "@/components/sidebar/lock";

/**
 * The one header of a page; each route owns its path and actions. Below the desktop
 * breakpoint it also holds the trigger of the app's sidebar, so a phone shows one
 * header row, and the app shell hides its own bar while a page shows this one. A page
 * that locks the shell, such as a running attempt, hides the trigger from its first
 * paint, as the shell hides its own bar, so nothing shifts when the lock applies. On a
 * desktop the sidebar sits beside the page, and the row is the page's alone.
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
        "sticky top-[var(--app-header-top,4rem)] z-10 flex min-h-16 w-full shrink-0 items-center border-b bg-background lg:top-0",
        className
      )}
      data-slot="page-header"
    >
      <ShellTitle />
      <SidebarScopeStart
        className="ps-4 group-has-[[data-shell-lock]]/sidebar-wrapper:hidden group-data-locked/sidebar-wrapper:hidden lg:hidden"
        label={tCommon("toggle-sidebar")}
      />
      <div
        className={cn(
          "mx-auto flex w-full min-w-0 max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6",
          contentClassName
        )}
      >
        {children}
      </div>
    </header>
  );
}
