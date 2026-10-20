import { createFileRoute, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { IntlProvider } from "use-intl";
import { EntryShellArtwork } from "@/components/entry/artwork.client";
import { EntryShell, EntryShellPanel } from "@/components/entry/shell";
import { ConvexProvider } from "@/components/providers/convex";
import { clientEnv } from "@/env.client";
import { readRouteMessages } from "@/lib/i18n/messages.fn";

/** The messages of the entry pages, which the shell messages join. */
const ENTRY_NAMESPACES = [
  "Auth",
  "Common",
  "Legal",
  "LearningPrograms",
  "SchoolStart",
  "State",
  "Toast",
] as const;

/**
 * The entry frame: one visual shell stays mounted while the sign-in, the error,
 * the onboarding and the school start change. The frame has its own messages.
 */
export const Route = createFileRoute("/$locale/_entry")({
  loader: ({ params }) =>
    readRouteMessages({
      data: { locale: params.locale, namespaces: ENTRY_NAMESPACES },
    }),
  component: EntryLayout,
});

/** Renders the entry frame around the entry page. */
function EntryLayout() {
  const { locale } = Route.useParams();
  const messages = Route.useLoaderData();
  return (
    <IntlProvider locale={locale} messages={messages}>
      <EntryShell>
        <EntryShellPanel>
          <NuqsAdapter>
            <ConvexProvider convexUrl={clientEnv.VITE_CONVEX_URL}>
              <Outlet />
            </ConvexProvider>
          </NuqsAdapter>
        </EntryShellPanel>
        <EntryShellArtwork />
      </EntryShell>
    </IntlProvider>
  );
}
