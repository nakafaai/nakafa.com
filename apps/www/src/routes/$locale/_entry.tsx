import { captureException } from "@repo/analytics/posthog/capture";
import {
  createFileRoute,
  type ErrorComponentProps,
  getRouteApi,
  Outlet,
  useParams,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { IntlProvider } from "use-intl";
import { EntryShellArtwork } from "@/components/entry/artwork.client";
import {
  EntryShell,
  EntryShellBody,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ConvexProvider } from "@/components/providers/convex";
import { ThemePicker } from "@/components/shared/theme/picker";
import { Broken } from "@/components/state/broken";
import { clientEnv } from "@/env.client";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { readStandaloneMessages } from "@/lib/i18n/standalone";

/** The messages of the entry pages, which the locale route's messages join. */
const ENTRY_NAMESPACES = [
  "Auth",
  "Legal",
  "LearningPrograms",
  "SchoolStart",
] as const;

const localeRoute = getRouteApi("/$locale");

/**
 * The entry frame: one visual shell stays mounted while the sign-in, the error,
 * the onboarding and the school start change. The frame's own messages join the
 * locale route's messages, which the frame does not load again.
 */
export const Route = createFileRoute("/$locale/_entry")({
  loader: ({ params }) =>
    readRouteMessages({
      data: { locale: params.locale, namespaces: ENTRY_NAMESPACES },
    }),
  component: EntryLayout,
  errorComponent: EntryError,
});

/** Renders the entry frame around the entry page. */
function EntryLayout() {
  const { locale } = Route.useParams();
  const messages = Route.useLoaderData();
  const { messages: shellMessages } = localeRoute.useLoaderData();
  return (
    <IntlProvider locale={locale} messages={{ ...shellMessages, ...messages }}>
      <EntryShell>
        <EntryShellPanel>
          {" "}
          <ConvexProvider convexUrl={clientEnv.VITE_CONVEX_URL}>
            <Outlet />
          </ConvexProvider>
        </EntryShellPanel>
        <EntryShellArtwork />
      </EntryShell>
    </IntlProvider>
  );
}

/**
 * Shows an entry failure inside the entry frame. The failed frame held the entry
 * messages, so the failure speaks the standalone dictionary of the locale.
 */
function EntryError({ error }: ErrorComponentProps) {
  const { locale } = useParams({ from: "/$locale" });
  const messages = readStandaloneMessages(locale);
  useEffect(() => {
    captureException(error, { source: "start-entry-error" });
  }, [error]);
  return (
    <EntryShell>
      <EntryShellPanel>
        <EntryShellHeader>
          <div className="ms-auto">
            <ThemePicker variant="ghost" />
          </div>
        </EntryShellHeader>
        <EntryShellBody>
          <Broken
            description={messages.Error.description}
            home={messages.State["home-button"]}
            homeHref={`/${locale}`}
            retry={messages.Error.retry}
            title={messages.Error.title}
          />
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
