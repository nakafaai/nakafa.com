import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import { AiChatSidebar } from "@/components/ai/chat-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-[calc(100svh-4rem)] lg:h-svh" data-pagefind-ignore>
      <div className="flex h-full">
        <ErrorBoundary fallback={null}>{children}</ErrorBoundary>

        <AiChatSidebar />
      </div>
    </main>
  );
}
