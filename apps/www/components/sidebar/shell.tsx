import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { SidebarInset } from "@repo/design-system/components/ui/sidebar-shell";
import type { ReactNode } from "react";
import { DeferredAiSheet } from "@/components/ai/deferred-sheet";
import { DeferredSearchCommand } from "@/components/shared/deferred-search-command";
import { NavExplore } from "@/components/sidebar/explore";
import { Header } from "@/components/sidebar/header/bar";
import { SidebarNavigation } from "@/components/sidebar/navigation";
import { AppSidebar } from "@/components/sidebar/panel";
import { NavForYou } from "@/components/sidebar/primary";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

/**
 * Renders the persistent app shell for the main student area.
 *
 * The shell composes the sidebar navigation slots around the resolved article
 * navigation, so the panel and the route chooser never carry data they do not
 * render themselves.
 */
export function AppShell({
  articleNavigation,
  children,
  locked = false,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <SidebarProvider
      className={locked ? "[--app-header-top:0px]" : "[--app-header-top:4rem]"}
      locked={locked}
    >
      <SidebarInset>
        {!locked && (
          <>
            <Header />
            <DeferredSearchCommand articleNavigation={articleNavigation} />
            <DeferredAiSheet />
          </>
        )}
        <div className="relative">{children}</div>
      </SidebarInset>
      <AppSidebar
        containerClassName="order-first"
        navigation={
          <SidebarNavigation
            browse={
              <>
                <NavForYou />
                <NavExplore articleNavigation={articleNavigation} />
              </>
            }
          />
        }
      />
    </SidebarProvider>
  );
}
