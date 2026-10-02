import type { ReactNode } from "react";
import { DeferredAiSheet } from "@/components/ai/sheet/deferred";
import { DeferredSearchCommand } from "@/components/search/command/deferred";
import { NavExplore } from "@/components/sidebar/explore";
import { Header } from "@/components/sidebar/header/bar";
import { LockableShell } from "@/components/sidebar/lock";
import { SidebarNavigation } from "@/components/sidebar/navigation";
import { AppSidebar } from "@/components/sidebar/panel";
import { NavForYou } from "@/components/sidebar/primary";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

/**
 * Renders the persistent app shell for the main student area and try-outs.
 *
 * The shell composes the sidebar navigation slots around the resolved article
 * navigation, so the panel and the route chooser never carry data they do not
 * render themselves. A page locks it by rendering `ShellLock`. The layout that
 * mounts the shell decides whether its pages stream inside it.
 *
 * The desktop sidebar keeps no gap in the page flow: the shell reserves its
 * width inside `<main>`, so a page that locks the shell never moves `<main>`.
 */
export function AppShell({
  articleNavigation,
  children,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
  children: ReactNode;
}) {
  return (
    <LockableShell
      header={
        <>
          <Header />
          <DeferredSearchCommand articleNavigation={articleNavigation} />
          <DeferredAiSheet />
        </>
      }
      sidebar={
        <AppSidebar
          containerClassName="[&>[data-slot=sidebar-gap]]:hidden"
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
      }
    >
      {children}
    </LockableShell>
  );
}
