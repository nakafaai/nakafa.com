import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ConvexProvider } from "@/components/providers/convex";
import {
  EntryShell,
  EntryShellArtwork,
  EntryShellPanel,
} from "@/components/shared/entry-shell";
import { env } from "@/env";

/**
 * Keeps one visual entry shell mounted while auth and onboarding content changes.
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
    <EntryShell>
      <EntryShellPanel>
        <NuqsAdapter>
          <ConvexProvider convexUrl={env.NEXT_PUBLIC_CONVEX_URL}>
            {children}
          </ConvexProvider>
        </NuqsAdapter>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
