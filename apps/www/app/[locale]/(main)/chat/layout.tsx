import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { AiChatSidebar } from "@/components/ai/chat-sidebar";

export default function Layout(props: LayoutProps<"/[locale]/chat">) {
  const { children, params } = props;
  const { locale } = use(params);
  if (!hasLocale(routing.locales, locale)) {
    // Ensure that the incoming `locale` is valid
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <main className="h-[calc(100svh-4rem)] lg:h-svh" data-pagefind-ignore>
      <div className="flex h-full">
        <ErrorBoundary fallback={null}>{children}</ErrorBoundary>

        <AiChatSidebar />
      </div>
    </main>
  );
}
