import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { env } from "@/env";
import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

type TryoutLocalizedPathArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.getLocalizedPath
>;

/** Resolves one signed try-out route to its exact localized counterpart. */
export const readPublishedTryoutLocalizedPath = Effect.fn(
  "www.tryouts.readLocalizedPath"
)(function* (args: TryoutLocalizedPathArgs) {
  return yield* readNakafaRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.tryouts.queries.catalog.getLocalizedPath,
    args
  );
});
