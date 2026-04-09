import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { AiChatSidebar } from "@/components/ai/chat-sidebar";

export default function Layout(props: LayoutProps<"/[locale]/chat">) {
  const { children } = props;
  return (
    <main className="h-[calc(100svh-4rem)] lg:h-svh" data-pagefind-ignore>
      <div className="flex h-full">
        <ErrorBoundary fallback={null}>{children}</ErrorBoundary>

        <AiChatSidebar />
      </div>
    </main>
  );
}
