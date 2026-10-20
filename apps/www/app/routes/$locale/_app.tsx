import { monospace } from "@repo/design-system/lib/monospace";
import { localeTimeZone } from "@repo/internationalization/src/locale";
import {
  createFileRoute,
  type ErrorComponentProps,
  getRouteApi,
  Outlet,
} from "@tanstack/react-router";
import { cn } from "cn";
import { IntlProvider } from "use-intl";
import { AppProviders } from "@/components/providers/app";
import { SharedProviders } from "@/components/providers/shared";
import { AppShell } from "@/components/sidebar/shell";
import { LocalizedError } from "@/components/state/localized";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { SHELL_MESSAGE_NAMESPACES } from "@/lib/i18n/shell";
import { readMarketingShellFn } from "@/lib/marketing/shell.fn";

const localeRoute = getRouteApi("/$locale");

/**
 * The signed-in document shell, the (app) layout of the reference. The app
 * providers, the shared feature state and the student shell mount here once, so
 * every page under `_app` keeps the same providers and sidebar as the visitor
 * moves between pages. Every page renders for one visitor on each request, so no
 * cache may keep it. Account screens pass the sign-in gate in `_account`; chat,
 * search and profiles stay open to visitors, as the reference keeps them.
 */
export const Route = createFileRoute("/$locale/_app")({
  loader: async ({ params }) => {
    const [shell, messages] = await Promise.all([
      readMarketingShellFn({ data: { locale: params.locale } }),
      readRouteMessages({
        data: { locale: params.locale, namespaces: SHELL_MESSAGE_NAMESPACES },
      }),
    ]);
    return { ...shell, messages };
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: AppLayout,
  errorComponent: AppError,
});

/** Mounts the signed-in providers and shell once, around the page of the visitor. */
function AppLayout() {
  const { articleNavigation, messages, pageNavigation } = Route.useLoaderData();
  const { locale } = Route.useParams();
  const localeData = localeRoute.useLoaderData();
  return (
    <IntlProvider
      locale={locale}
      messages={{ ...localeData.messages, ...messages }}
      now={localeData.now}
      timeZone={localeTimeZone(locale)}
    >
      <AppProviders pageNavigation={pageNavigation}>
        <SharedProviders>
          <AppShell articleNavigation={articleNavigation}>
            <div className={cn(monospace, "contents")}>
              <Outlet />
            </div>
          </AppShell>
        </SharedProviders>
      </AppProviders>
    </IntlProvider>
  );
}

/**
 * The (app) error boundary: a failure of a signed-in page reports once and shows
 * the error state with a way home, in the visitor's locale.
 */
function AppError({ error }: ErrorComponentProps) {
  const { locale } = Route.useParams();
  return (
    <LocalizedError error={error} locale={locale} source="app-route-error" />
  );
}
