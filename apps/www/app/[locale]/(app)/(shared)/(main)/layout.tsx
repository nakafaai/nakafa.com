import { AppShell } from "@/components/sidebar/app-shell";

/**
 * Renders the shared student shell for learn pages and core signed-in routes.
 *
 * Keeping one shell instance for both route groups avoids shell-state
 * divergence across cross-group navigations under Cache Components.
 */
export default function Layout(props: LayoutProps<"/[locale]">) {
  const { children } = props;
  return <AppShell>{children}</AppShell>;
}
