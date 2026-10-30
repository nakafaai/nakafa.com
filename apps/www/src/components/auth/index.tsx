import { useEffect } from "react";
import { AuthForward } from "@/components/auth/forward";
import { Unauthenticated } from "@/components/auth/gate";
import { AuthGoogle } from "@/components/auth/google";
import { useAuthSession, useAuthSessionStore } from "@/components/auth/session";
import { followSignedInHint } from "@/lib/auth/hint";

/**
 * The sign-in action of the main site: the Google button for a visitor, and the
 * move on for a visitor whose session Better Auth confirms. The page hides its
 * body before the first paint while the signed-in hint says a session may exist.
 * Every answer about the session corrects the hint cookie, so the root follows
 * it again after each answer, and a hint that outlived its session shows the
 * page once Better Auth says there is none.
 */
export function Auth() {
  const session = useAuthSessionStore();
  const signedIn = useAuthSession((state) => state.userId !== null);

  useEffect(() => {
    const follow = () =>
      followSignedInHint(document.documentElement, document.cookie);
    follow();
    return session.subscribe(follow);
  }, [session]);

  return (
    <div className="flex min-h-9 items-center justify-center">
      {signedIn ? <AuthForward /> : null}
      <Unauthenticated>
        <AuthGoogle />
      </Unauthenticated>
    </div>
  );
}
