import { readTryoutLocalizedPath } from "@repo/backend/content/tryout/metadata";
import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

type TryoutLocalizedPathArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.getLocalizedPath
>;

/** Resolves one signed try-out route to its exact localized counterpart. */
export const readPublishedTryoutLocalizedPath = Effect.fn(
  "www.tryouts.readLocalizedPath"
)(function* (args: TryoutLocalizedPathArgs) {
  return yield* readRuntimeQuery(
    api.tryouts.queries.catalog.getLocalizedPath,
    args,
    readTryoutLocalizedPath
  );
});
