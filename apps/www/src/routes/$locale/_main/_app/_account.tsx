import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sessionFn } from "@/lib/auth/session.functions";

/**
 * Admits a signed-in visitor to the account screens (home, notifications and
 * settings). A visitor without a session is sent to sign-in with 307, as the
 * reference's `admitAccountRoute` and home page do. The gate runs before every
 * child loader, so no account read starts for a visitor who must sign in.
 */
export const Route = createFileRoute("/$locale/_main/_app/_account")({
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
  component: AccountLayout,
});

/** The provider loads after the gate, so the client module loads for a signed-in viewer only. */
const RouteConvexProvider = lazy(() =>
  import("@/components/providers/route").then(({ RouteConvexProvider }) => ({
    default: RouteConvexProvider,
  }))
);

/**
 * Mounts the one client that the account screens read. The gate above runs before
 * this layout renders and admits only a signed-in viewer, so no visitor reaches it.
 */
function AccountLayout() {
  return (
    <Suspense fallback={null}>
      <RouteConvexProvider>
        <Outlet />
      </RouteConvexProvider>
    </Suspense>
  );
}
