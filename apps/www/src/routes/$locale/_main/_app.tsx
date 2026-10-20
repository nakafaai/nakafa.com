import {
  createFileRoute,
  type ErrorComponentProps,
  getRouteApi,
  Outlet,
} from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { IntlProvider } from "use-intl";
import { LocalizedError } from "@/components/state/localized";
import { clientEnv } from "@/env.public";
import { readConvexClient } from "@/lib/convex/client";
import { readRouteMessages } from "@/lib/i18n/messages.functions";

/**
 * The messages of the signed-in screens that the student shell and the locale
 * route do not carry. They join the shell's messages, so no screen loses one.
 */
const APP_NAMESPACES = [
  "Comments",
  "Editor",
  "Memory",
  "Posts",
  "Pricing",
  "Subject",
  "Videos",
  "Weather",
] as const;

const localeRoute = getRouteApi("/$locale");
const mainRoute = getRouteApi("/$locale/_main");

/**
 * The signed-in document shell. It nests inside the student shell of `_main`, so
 * the sidebar and the live session mount once. Its screens read Convex through
 * the page's one client, which this shell creates on entry: navigating here is
 * the intent that needs it, while the learn pages that come before do not. Every
 * page under `_app` renders for one visitor on each request, so no cache may keep
 * it. Account screens pass the sign-in gate in `_account`; chat, search and
 * profiles stay open to visitors, as the reference keeps them.
 */
export const Route = createFileRoute("/$locale/_main/_app")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  loader: ({ params }) =>
    readRouteMessages({
      data: { locale: params.locale, namespaces: APP_NAMESPACES },
    }),
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
      <ConvexProvider client={readConvexClient(clientEnv.VITE_CONVEX_URL)}>
        <Outlet />
      </ConvexProvider>
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
