import { monospace } from "@repo/design-system/lib/monospace";
import {
  createFileRoute,
  type ErrorComponentProps,
  Outlet,
} from "@tanstack/react-router";
import { cn } from "cn";
import { AppProviders } from "@/components/providers/app";
import { SharedProviders } from "@/components/providers/shared";
import { AppShell } from "@/components/sidebar/shell";
import { LocalizedError } from "@/components/state/localized";
import { readMarketingShellFn } from "@/lib/marketing/shell.fn";

/**
 * The signed-in document shell, the (app) layout of the reference. The app
 * providers, the shared feature state and the student shell mount here once, so
 * every page under `_app` keeps the same providers and sidebar as the visitor
 * moves between pages. Every page renders for one visitor on each request, so no
 * cache may keep it. Account screens pass the sign-in gate in `_account`; chat,
 * search and profiles stay open to visitors, as the reference keeps them.
 */
export const Route = createFileRoute("/$locale/_app")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  loader: ({ params }) =>
    readMarketingShellFn({ data: { locale: params.locale } }),
  component: AppLayout,
  errorComponent: AppError,
});

/** Mounts the signed-in providers and shell once, around the page of the visitor. */
function AppLayout() {
  const { articleNavigation, pageNavigation } = Route.useLoaderData();
  return (
    <AppProviders pageNavigation={pageNavigation}>
      <SharedProviders>
        <AppShell articleNavigation={articleNavigation}>
          <div className={cn(monospace, "contents")}>
            <Outlet />
          </div>
        </AppShell>
      </SharedProviders>
    </AppProviders>
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
