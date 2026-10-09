import { HttpClient } from "@confect/js";
import "server-only";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Schema } from "effect";
import { httpLayer } from "@/lib/convex/http";

const ActiveContentIdentitySchema = Schema.NullOr(
  Schema.Struct({
    manifestHash: Sha256HashSchema,
    releaseId: ReleaseIdSchema,
    sequence: Schema.Finite,
  })
);
/** Integrity-checked active publication identity returned by Convex. */
type ActiveContentIdentity = typeof ActiveContentIdentitySchema.Type;
/** Release identity used to bind ownership and body cache entries. */
export type ActiveContentReleaseId =
  NonNullable<ActiveContentIdentity>["releaseId"];
/** Reads the exact integrity-checked active content release identity. */
export const readActiveContentIdentity = Effect.fn(
  "NakafaContent.readActiveContentIdentity"
)(function* () {
  const identity = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.runtime.active.read, {})
  ).pipe(Effect.provide(httpLayer()));
  return yield* Schema.decodeEffect(ActiveContentIdentitySchema)(identity);
});
