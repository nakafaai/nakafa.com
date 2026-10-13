import "server-only";
import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { Effect, String as Str } from "effect";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/**
 * Reads the profile at `@username` once for a whole request, so the layout and
 * the page of one profile share a single query.
 *
 * A profile is public only for an adult who belongs to no school (K15 of the
 * owner's decisions), and the product stores neither an age nor a way to tell
 * one, so no profile is public yet. Its owner opens it, because it is the page
 * of their own chats and comments. Every other visitor ends the request as not
 * found, the same as for a username nobody holds, so the answer never tells
 * whether a username exists. A public profile needs a stored age first.
 */
export const readProfile = cache(async (address: string) => {
  const token = await getToken();
  const account = token
    ? await Effect.runPromise(
        HttpClient.HttpClient.pipe(
          Effect.flatMap((client) =>
            client.query(auth.queries.getCurrentUser, {})
          ),
          Effect.provide(httpLayer({ auth: token }))
        )
      )
    : null;
  const username = Str.toLowerCase(address);
  if (account === null || account.appUser.username !== username) {
    notFound();
  }
  return { account, username };
});
