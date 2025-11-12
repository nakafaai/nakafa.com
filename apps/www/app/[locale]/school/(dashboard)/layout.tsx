import {
  SidebarInset,
  SidebarProvider,
} from "@repo/design-system/components/ui/sidebar";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolSidebar } from "@/components/school/sidebar";
import { Header } from "@/components/sidebar/header";

export default function Layout(props: LayoutProps<"/[locale]/school">) {
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
      <SidebarInset>
        <Header />
        <div className="relative">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
