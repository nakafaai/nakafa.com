import "server-only";

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Either, Schema } from "effect";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

const ActiveContentIdentitySchema = Schema.NullOr(
  Schema.Struct({
    manifestHash: Sha256HashSchema,
    releaseId: ReleaseIdSchema,
    sequence: Schema.Number,
  })
);

/** Integrity-checked active publication identity returned by Convex. */
export type ActiveContentIdentity = typeof ActiveContentIdentitySchema.Type;

/** Release identity used to bind ownership and body cache entries. */
export type ActiveContentReleaseId =
  NonNullable<ActiveContentIdentity>["releaseId"];

/** Reads the exact integrity-checked active content release identity. */
export const readActiveContentIdentity = Effect.fn(
  "NakafaContent.readActiveContentIdentity"
)(function* () {
  const identity = yield* readRuntimeQuery(
    "contentRelease.runtime.active.read",
    () => fetchRuntimeQuery(api.contentRelease.runtime.active.read, {})
  );

  return yield* Schema.decodeUnknown(ActiveContentIdentitySchema)(identity);
});

/**
 * Reads the active identity without starting an Effect fiber during prerender.
 *
 * Static RSCs use the official Convex Promise boundary and Effect's synchronous
 * Either decoder. Starting an Effect runtime here would read the current time,
 * which Cache Components reject during static prerender.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function fetchActiveContentIdentity() {
  return fetchRuntimeQuery(api.contentRelease.runtime.active.read, {}).then(
    (identity) => {
      const decoded = Schema.decodeUnknownEither(ActiveContentIdentitySchema)(
        identity
      );
      if (Either.isLeft(decoded)) {
        return Promise.reject(decoded.left);
      }
      return decoded.right;
    }
  );
}

/** Caches the globally active publication identity under content invalidation. */
export async function getActiveContentIdentity() {
  "use cache";

  applyContentRuntimeCache();

  return await fetchActiveContentIdentity();
}
