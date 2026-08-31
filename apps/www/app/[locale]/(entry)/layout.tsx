import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ConvexProvider } from "@/components/providers/convex";
import { env } from "@/env";
import { UserContextProvider } from "@/lib/context/use-user";

/**
 * Mounts the minimal auth-capable runtime shared by auth and onboarding.
 *
 * Entry pages intentionally live outside the shared `(app)` subtree so account
 * changes fully tear down the authenticated Convex provider and onboarding
 * does not depend on the published application shell.
 *
 * @see apps/www/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
 * @see apps/www/node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
 */
export default function Layout({ children }: LayoutProps<"/[locale]">) {
  return (
    <NuqsAdapter>
      <ConvexProvider convexUrl={env.NEXT_PUBLIC_CONVEX_URL}>
        <UserContextProvider>{children}</UserContextProvider>
      </ConvexProvider>
    </NuqsAdapter>
  );
}
