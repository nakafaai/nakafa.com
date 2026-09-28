import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { AiChatSidebar } from "@/components/ai/chat/sidebar";

export default function Layout(props: LayoutProps<"/[locale]/chat">) {
  const { children } = props;
  return (
    <main className="h-[calc(100svh-4rem)] [--app-header-top:0px] lg:h-svh">
      <SidebarProvider
        className="h-full min-h-0"
        cookieName="sidebar_state:ai-chat"
        keyboardShortcut="h"
        sidebarDesktop={1279}
      >
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <ErrorBoundary fallback={null}>{children}</ErrorBoundary>
        </div>

        <AiChatSidebar />
      </SidebarProvider>
    </main>
  );
}
