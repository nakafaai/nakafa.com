import "server-only";
import { HttpClient } from "@confect/js";
import users from "@repo/backend/confect/_generated/refs/users";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import { cache } from "react";
import { httpLayer } from "@/lib/convex/http";

/**
 * Reads the profile at `@username` once for a whole request, so the layout, the
 * page, and the metadata of one profile share a single query. A username that
 * nobody holds ends the request as not found.
 */
export const readProfile = cache(async (username: string) => {
  const profile = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) =>
        client.query(users.queries.getProfileByUsername, { username })
      ),
      Effect.provide(httpLayer())
    )
  );
  return profile ?? notFound();
});
