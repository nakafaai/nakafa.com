import { AuthForward } from "@/components/auth/forward";
import { AuthGoogle } from "@/components/auth/google";
import { useAuthSession } from "@/components/auth/session";

/**
 * The sign-in action of the main site: the move on for a visitor whose session
 * Better Auth confirms, and the Google button for everyone else, in the page's
 * first HTML, so a visitor on a slow phone sees the one action of the page from
 * its first paint. The page hides its body before the first paint while the
 * signed-in hint says a session may exist, so a learner never sees the button.
 * A hint that outlived its session shows the page once Better Auth says there is
 * none (`useSignedInHint`).
 */
export function Auth() {
  const signedIn = useAuthSession((state) => state.userId !== null);

  return (
    <div className="flex min-h-9 items-center justify-center">
      {signedIn ? <AuthForward /> : <AuthGoogle />}
    </div>
  );
}
