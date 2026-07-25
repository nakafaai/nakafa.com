import "server-only";

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Schema } from "effect";
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

/** Caches the globally active publication identity under content invalidation. */
export async function getActiveContentIdentity() {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(readActiveContentIdentity());
}
