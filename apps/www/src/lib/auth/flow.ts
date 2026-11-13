import { Effect, Fiber, Predicate } from "effect";
import { type AuthConvex, readAuthClient } from "@/lib/auth/client";

/**
 * Reports whether Google's last return to the page failed, for as long as the
 * scope lives. Convex Auth completes a Google sign-in when the page's client
 * starts, and publishes a failure under its oauth values, not in the address.
 */
const reportFailure = Effect.fn("www.auth.reportGoogleFailure")(function* (
  convex: AuthConvex,
  listener: (failed: boolean) => void
) {
  const client = yield* readAuthClient(convex);
  const values = client.ambientSignInValues("oauth");
  const emit = () => listener(Predicate.isNotNullish(values.get("flowError")));
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      const stop = values.subscribe("flowError", emit);
      emit();
      return stop;
    }),
    (stop) => Effect.sync(stop)
  );
  return yield* Effect.never;
}, Effect.scoped);

/** Whether Google's last return to the page failed, for the sign-in button to follow. */
export function followGoogleFailure(convex: AuthConvex) {
  return {
    subscribe: (listener: (failed: boolean) => void) => {
      const fiber = Effect.runFork(reportFailure(convex, listener));
      return () => {
        Effect.runFork(Fiber.interrupt(fiber));
      };
    },
  };
}
