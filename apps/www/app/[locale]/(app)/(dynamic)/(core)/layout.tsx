import { AppShell } from "@/components/sidebar/app-shell";

/** Renders the core signed-in application subtree inside the default app shell. */
export default function Layout(props: LayoutProps<"/[locale]">) {
  const { children } = props;
  return <AppShell>{children}</AppShell>;
}
