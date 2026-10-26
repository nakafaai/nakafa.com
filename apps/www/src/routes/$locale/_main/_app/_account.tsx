import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { RouteConvexProvider } from "@/components/providers/route";
import { hasSignedInHint } from "@/lib/auth/hint";
import { sessionFn } from "@/lib/auth/session.functions";

/**
 * Whether the visitor may open an account screen: the session on the server, and
 * the signed-in hint in the browser. The gate runs on every move between account
 * screens, so the browser reads the hint and waits on no server request. Every
 * account read checks the session itself, so a stale hint opens no data.
 */
const isSignedIn = createIsomorphicFn()
  .server(async () => (await sessionFn())._tag === "SignedIn")
  .client(() => Promise.resolve(hasSignedInHint(document.cookie)));

/**
 * Admits a signed-in visitor to the account screens (home, notifications and
 * settings). A visitor without a session is sent to sign-in with 307, as the
 * reference's `admitAccountRoute` and home page do. The gate runs before every
 * child loader, so no account read starts for a visitor who must sign in.
 */
export const Route = createFileRoute("/$locale/_main/_app/_account")({
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
