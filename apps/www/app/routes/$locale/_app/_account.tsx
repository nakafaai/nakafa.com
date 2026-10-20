import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { sessionFn } from "@/lib/auth/session.fn";

/**
 * Admits a signed-in visitor to the account screens (home, notifications and
 * settings). A visitor without a session is sent to sign-in with 307, as the
 * reference's `admitAccountRoute` and home page do. The gate runs before every
 * child loader, so no account read starts for a visitor who must sign in.
 */
export const Route = createFileRoute("/$locale/_app/_account")({
  beforeLoad: async ({ params }) => {
    const session = await sessionFn();
    if (session._tag === "SignedOut") {
      throw redirect({
        to: "/$locale/auth",
        params: { locale: params.locale },
        statusCode: 307,
      });
    }
  },
  component: Outlet,
});
