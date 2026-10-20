import "@tanstack/react-start/server-only";

import { getRequest } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { env } from "@/env";
import { readSessionToken } from "@/lib/auth/token";

/**
 * The Better Auth token of the request's visitor, or nothing for a visitor
 * without a session. Its failures stay typed, so a route answers them with its
 * error boundary instead of a signed-out view.
 */
export const readRequestToken = Effect.fn("www.tryout.route.readRequestToken")(
  function* () {
    return yield* readSessionToken(
      env.VITE_CONVEX_SITE_URL,
      getRequest().headers
    );
  }
);
