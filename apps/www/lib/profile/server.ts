import "@tanstack/react-start/server-only";
import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import users from "@repo/backend/confect/_generated/refs/users";
import { notFound } from "@tanstack/react-router";
import { Effect, String as Str } from "effect";
import { cache } from "react";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/**
 * Reads the profile at `@username` once for a whole request, so the layout and
 * the page of one profile share a single query.
 *
 * Anyone may read a profile, signed in or not, so the profile is read by its
 * username. A username nobody holds ends the request as not found, the same
 * answer the proxy gives before the page renders. The owner is the signed-in
 * account whose app user is the profile's, and only the owner sees the controls
 * of their own profile.
 */
export const readProfile = cache(async (address: string) => {
  const username = Str.toLowerCase(address);
  const token = await getToken();
  const [profile, account] = await Promise.all([
    Effect.runPromise(
      HttpClient.HttpClient.pipe(
        Effect.flatMap((client) =>
          client.query(users.queries.getProfileByUsername, { username })
        ),
        Effect.provide(httpLayer())
      )
    ),
    token
      ? Effect.runPromise(
          HttpClient.HttpClient.pipe(
            Effect.flatMap((client) =>
              client.query(auth.queries.getCurrentUser, {})
            ),
            Effect.provide(httpLayer({ auth: token }))
          )
        )
      : Promise.resolve(null),
  ]);
  if (profile === null) {
    throw notFound();
  }
  return {
    isOwner: account !== null && account.appUser._id === profile._id,
    profile,
  };
});
