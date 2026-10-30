import {
  createFileRoute,
  type ErrorComponentProps,
  getRouteApi,
  Outlet,
} from "@tanstack/react-router";
import { IntlProvider } from "use-intl";
import { LocalizedError, useRouteFailure } from "@/components/state/localized";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/**
 * The messages of the signed-in screens that the student shell and the locale
 * route do not carry. They join the shell's messages, so no screen loses one.
 */
const APP_NAMESPACES = [
  "Editor",
  "Memory",
  "Subject",
  "Videos",
  "Weather",
] as const;

const localeRoute = getRouteApi("/$locale");
const mainRoute = getRouteApi("/$locale/_main");

/**
 * The signed-in document shell. It nests inside the student shell of `_main`, so
 * the sidebar and the live session mount once. The screens under it read Convex
 * through the page's one client, and each Convex leaf islands itself, so a visitor
 * opens no socket here. Every page under `_app` renders for one visitor on each
 * request, so no cache may keep it. Account screens pass the sign-in gate in
 * `_account`, which mounts the client; chat, search and profiles stay open to
 * visitors, as the reference keeps them.
 */
export const Route = createFileRoute("/$locale/_main/_app")({
  loader: ({ params }) =>
    readRenderedRouteMessages({
      locale: params.locale,
      namespaces: APP_NAMESPACES,
    }),
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: AppLayout,
  errorComponent: AppError,
});

/** Renders the signed-in screens with their own messages joined to the shell's. */
function AppLayout() {
  const { locale } = Route.useParams();
  const messages = Route.useLoaderData();
  const { messages: mainMessages } = mainRoute.useLoaderData();
  const { messages: shellMessages } = localeRoute.useLoaderData();
  return (
    <IntlProvider
      locale={locale}
      messages={{ ...shellMessages, ...mainMessages, ...messages }}
    >
      <Outlet />
    </IntlProvider>
  );
}

/**
 * The (app) error boundary: a failure of a signed-in page reports once and shows
 * the error state with a way home, in the visitor's locale.
 */
function AppError({ error }: ErrorComponentProps) {
  const { locale } = Route.useParams();
  const reloading = useRouteFailure(error, "app-route-error");
  return reloading ? null : <LocalizedError locale={locale} />;
}
