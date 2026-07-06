import { AppShell } from "@/components/sidebar/app-shell";

/** Renders the shared tryout shell for every route in the tryout subtree. */
export default function Layout({ children }: LayoutProps<"/[locale]/try-out">) {
  return <AppShell>{children}</AppShell>;
}
