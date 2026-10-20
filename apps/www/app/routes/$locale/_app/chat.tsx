import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ChatBoundary } from "@/components/ai/chat/boundary";
import { AiChatSidebar } from "@/components/ai/chat/sidebar";

export const Route = createFileRoute("/$locale/_app/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <main className="h-[calc(100svh-var(--app-header-top,4rem))] lg:h-svh">
      <SidebarProvider
        className="h-full min-h-0"
        cookieName="sidebar_state:ai-chat"
        keyboardShortcut="shift+u"
        sidebarDesktop={1279.98}
      >
        <div className="relative min-w-0 flex-1 overflow-hidden [--app-header-top:0px]">
          <ChatBoundary>
            <Outlet />
          </ChatBoundary>
        </div>
        <AiChatSidebar />
      </SidebarProvider>
    </main>
  );
}
