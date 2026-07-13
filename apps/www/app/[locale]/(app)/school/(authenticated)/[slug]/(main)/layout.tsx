import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { SidebarInset } from "@repo/design-system/components/ui/sidebar-shell";
import { SchoolSidebar } from "@/components/school/sidebar";

export default function Layout({
  children,
}: LayoutProps<"/[locale]/school/[slug]">) {
  return (
    <SidebarProvider>
      <SchoolSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
