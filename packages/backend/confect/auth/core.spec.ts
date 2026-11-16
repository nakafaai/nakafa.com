import { FunctionSpec, GroupSpec } from "@confect/core";
import type {
  completeSignInWithGoogle,
  isAuthenticated,
  refreshSession,
  signInWithUsernamePassword,
  signOut,
  startSignInWithGoogle,
} from "@repo/backend/confect/auth/core";

/**
 * Convex Auth's own functions (ADR 0009). The SDK registers them, so each one
 * keeps Convex Auth's validators and handler. The web app's auth routes call
 * the session ones, and its sign-in route forwards the sign-in ones.
 * https://confect.dev/v10/server/plain-convex-functions
 */
export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicMutation<typeof signOut>()("signOut"))
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof refreshSession>()("refreshSession")
  )
  .addFunction(
    FunctionSpec.convexPublicQuery<typeof isAuthenticated>()("isAuthenticated")
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof startSignInWithGoogle>()(
      "startSignInWithGoogle"
    )
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof completeSignInWithGoogle>()(
      "completeSignInWithGoogle"
    )
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof signInWithUsernamePassword>()(
      "signInWithUsernamePassword"
    )
  );
