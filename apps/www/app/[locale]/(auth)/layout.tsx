import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ConvexProvider } from "@/components/providers/convex";
import { UserContextProvider } from "@/lib/context/use-user";

/**
 * Mounts the minimal auth-capable runtime for the standalone `/auth` route.
 *
 * The page intentionally lives outside the shared `(app)` subtree so account
 * changes fully tear down the authenticated Convex provider before the next
 * protected route mounts again.
 *
 * @see apps/www/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
 * @see apps/www/node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
 */
export default function Layout({ children }: LayoutProps<"/[locale]">) {
  return (
    <NuqsAdapter>
      <ConvexProvider>
        <UserContextProvider>{children}</UserContextProvider>
      </ConvexProvider>
    </NuqsAdapter>
  );
}
