import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Option } from "effect";
import { ChatBoundary } from "@/components/ai/chat/boundary";
import { AiChatSidebar } from "@/components/ai/chat/sidebar";
import { chatSidebarScreenFn } from "@/lib/account/home.functions";

/**
 * The first page of the chat list on the server, where it draws the document. A move
 * between pages in the browser reads the list live, so it waits on no Worker.
 */
const readChatSidebar = createIsomorphicFn()
  .server(() => chatSidebarScreenFn())
  .client(() => ({ first: undefined }));

export const Route = createFileRoute("/$locale/_main/_app/chat")({
  loader: () => readChatSidebar(),
  component: ChatLayout,
});

function ChatLayout() {
  const { first } = Route.useLoaderData();
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
        <AiChatSidebar first={Option.fromUndefinedOr(first)} />
      </SidebarProvider>
    </main>
  );
}
