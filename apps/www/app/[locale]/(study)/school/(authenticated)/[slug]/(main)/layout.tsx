import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolHeader } from "@/components/school/header";
import { SchoolSidebar } from "@/components/school/sidebar";

export default function Layout(props: LayoutProps<"/[locale]/school/[slug]">) {
  const { children, params } = props;
  const { locale } = use(params);
  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <SidebarProvider>
      <SchoolSidebar />
      <main className="h-svh w-full overflow-hidden lg:p-2 lg:pl-0 lg:peer-data-[state=collapsed]:pl-2">
        <div className="flex h-full w-full flex-col items-center justify-start overflow-hidden bg-background lg:rounded-lg lg:border">
          <SchoolHeader />

          <div className="min-h-0 w-full flex-1">{children}</div>
        </div>
      </main>
    </SidebarProvider>
  );
}
