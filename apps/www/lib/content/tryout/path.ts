import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "server-only";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import { httpLayer } from "@/lib/convex/http";

type TryoutLocalizedPathArgs = Ref.Args<
  typeof refs.public.tryouts.queries.catalog.getLocalizedPath
>;

/** Resolves one signed try-out route to its exact localized counterpart. */
export const readPublishedTryoutLocalizedPath = Effect.fn(
  "www.tryouts.readLocalizedPath"
)(function* (args: TryoutLocalizedPathArgs) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.tryouts.queries.catalog.getLocalizedPath, args)
  ).pipe(Effect.provide(httpLayer()));
});
