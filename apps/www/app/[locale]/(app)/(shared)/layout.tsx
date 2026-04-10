import { SharedProviders } from "@/components/providers/shared";

/**
 * Mounts the shared client-side provider boundary for the marketing, main, and
 * tryout route groups.
 *
 * Keeping this boundary above `(site)`, `(main)`, and `try-out` removes
 * duplicate provider mounts without widening client-only state to unrelated
 * routes like `auth` and `school`.
 */
export default function Layout(props: LayoutProps<"/[locale]">) {
  const { children } = props;
  return <SharedProviders>{children}</SharedProviders>;
}
