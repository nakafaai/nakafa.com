import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import { env } from "@/env";
import "server-only";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";

type TryoutLocalizedPathArgs = Ref.Args<
  typeof refs.public.tryouts.queries.catalog.getLocalizedPath
>;

/** Resolves one signed try-out route to its exact localized counterpart. */
export const readPublishedTryoutLocalizedPath = Effect.fn(
  "www.tryouts.readLocalizedPath"
)(function* (args: TryoutLocalizedPathArgs) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.tryouts.queries.catalog.getLocalizedPath, args)
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
});
