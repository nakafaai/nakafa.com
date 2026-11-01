import {
  createFileRoute,
  Navigate,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { Option } from "effect";
import { Unauthenticated } from "@/components/auth/gate";
import { useLiveSession } from "@/components/providers/live";
import { RouteConvexProvider } from "@/components/providers/route";
import { getPostAuthSignInTarget } from "@/lib/auth/admission";
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
  beforeLoad: async ({ location, params }) => {
    if (!(await isSignedIn())) {
      throw redirect({
        ...getPostAuthSignInTarget(location.href, params.locale),
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
      <SessionEnd />
      <Outlet />
    </RouteConvexProvider>
  );
}

/**
 * Sends the reader to sign-in once Better Auth answers that no session stands under
 * an open screen: one that ended in another tab or on the server, or a hint that
 * outlived its session. The gate above reads only on a move between pages. The live
 * session reads signed out until the page starts it after hydration, so that state
 * means nothing here: an answer counts only once the page holds its client, which
 * the start sets with the session pending.
 */
function SessionEnd() {
  const { locale } = Route.useParams();
  const started = useLiveSession((state) => Option.isSome(state.client));
  return started ? (
    <Unauthenticated>
      <Navigate params={{ locale }} replace to="/$locale/auth" />
    </Unauthenticated>
  ) : null;
}
