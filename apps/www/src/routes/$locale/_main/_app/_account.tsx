import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { RouteConvexProvider } from "@/components/providers/route";
import { isSignedIn } from "@/lib/auth/gate";

/**
 * Admits a signed-in visitor to the account screens (home, notifications and
 * settings). The screens render only in the browser (ADR 0038 D2): the Worker
 * answers them with the browser shell, and this gate reads the session hint in
 * the browser and sends a visitor without one to sign-in. The gate runs before
 * every child loader, so no account read starts for a visitor who must sign in.
 */
export const Route = createFileRoute("/$locale/_main/_app/_account")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    if (!(await isSignedIn())) {
      throw redirect({
        to: "/$locale/auth",
        params: { locale: params.locale },
        statusCode: 307,
      });
    }
  },
  component: AccountLayout,
});

/**
 * Mounts the one client that the account screens read. The gate above runs before
 * this layout loads: the router loads a route's component chunk, and the provider
 * with it, beside the loaders and after `beforeLoad`, so a visitor never loads the
 * client and a learner's page waits on no lazy chunk after its data.
 */
function AccountLayout() {
  return (
    <RouteConvexProvider>
      <Outlet />
    </RouteConvexProvider>
  );
}
