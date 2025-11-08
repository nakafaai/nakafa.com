import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { AiChatSidebar } from "@/components/ai/chat-sidebar";

export default function Layout(props: LayoutProps<"/[locale]/chat">) {
  const { children, params } = props;
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale as Locale);

  return (
    <main className="h-[calc(100svh-4rem)] lg:h-svh" data-pagefind-ignore>
      <div className="flex h-full">
        <ErrorBoundary fallback={null}>
          <Suspense>{children}</Suspense>
        </ErrorBoundary>

        <AiChatSidebar />
      </div>
    </main>
  );
}
