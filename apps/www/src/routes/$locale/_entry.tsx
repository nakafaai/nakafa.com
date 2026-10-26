import {
  createFileRoute,
  type ErrorComponentProps,
  getRouteApi,
  Outlet,
  useParams,
} from "@tanstack/react-router";
import { IntlProvider } from "use-intl";
import { EntryShellArtwork } from "@/components/entry/artwork";
import {
  EntryShell,
  EntryShellBody,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ConvexProvider } from "@/components/providers/convex";
import { ThemePicker } from "@/components/shared/theme/picker";
import { ActionLink } from "@/components/state/action";
import { Broken, BrokenRetry } from "@/components/state/broken";
import { useRouteFailure } from "@/components/state/localized";
import { clientEnv } from "@/env.public";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { readStandaloneMessages } from "@/lib/i18n/standalone";

/** The messages of the entry pages, which the locale route's messages join. */
const ENTRY_NAMESPACES = [
  "Auth",
  "Legal",
  "LearningPrograms",
  "ReportCheck",
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
  const reloading = useRouteFailure(error, "start-entry-error");
  if (reloading) {
    return null;
  }
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
            title={messages.Error.title}
          >
            <BrokenRetry>{messages.Error.retry}</BrokenRetry>
            <ActionLink
              href={`/${locale}`}
              label={messages.State["home-button"]}
              variant="ghost"
            />
          </Broken>
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
