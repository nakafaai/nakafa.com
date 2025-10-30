import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import { AiChatSidebar } from "@/components/ai/chat-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallback={null}>
      <main className="h-[calc(100svh-4rem)] lg:h-svh">
        <div className="flex h-full">
          {children}

          <AiChatSidebar />
        </div>
      </main>
    </ErrorBoundary>
  );
}
