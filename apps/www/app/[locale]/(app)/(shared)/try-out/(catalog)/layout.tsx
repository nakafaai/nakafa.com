import { AppShell } from "@/components/sidebar/app-shell";

/** Renders the shared plain shell for the tryout hub and product catalog routes. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
