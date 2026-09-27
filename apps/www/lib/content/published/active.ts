import { HttpClient } from "@confect/js";
import { env } from "@/env";
import "server-only";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect, Schema } from "effect";

const ActiveContentIdentitySchema = Schema.NullOr(
  Schema.Struct({
    manifestHash: Sha256HashSchema,
    releaseId: ReleaseIdSchema,
    sequence: Schema.Finite,
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
  const identity = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.runtime.active.read, {})
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
  return yield* Schema.decodeEffect(ActiveContentIdentitySchema)(identity);
});
