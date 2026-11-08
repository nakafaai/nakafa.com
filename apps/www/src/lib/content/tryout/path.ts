import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Effect } from "effect";
import { queryContentStore } from "@/lib/content/store/query";

type TryoutLocalizedPathArgs = Ref.Args<
  typeof tryouts.queries.catalog.getLocalizedPath
>;

/** Resolves one signed try-out route to its exact localized counterpart. */
export const readPublishedTryoutLocalizedPath = Effect.fn(
  "www.tryouts.readLocalizedPath"
)(function* (args: TryoutLocalizedPathArgs) {
  return yield* queryContentStore(
    tryouts.queries.catalog.getLocalizedPath,
    args
  );
});
