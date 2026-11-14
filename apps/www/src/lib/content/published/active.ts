import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Duration, Effect, Option, Schema } from "effect";
import {
  expireStoreTag,
  readStoreEntry,
  writeStoreEntry,
} from "@/lib/content/store/entry";
import { httpLayer } from "@/lib/convex/http";

/**
 * Integrity-checked active publication identity returned by Convex, with the
 * snapshot each structured family resolves to under the release. A family's
 * snapshot stays until a release changes that family.
 */
const ActiveContentIdentitySchema = Schema.NullOr(
  Schema.Struct({
    manifestHash: Sha256HashSchema,
    releaseId: ReleaseIdSchema,
    sequence: Schema.Finite,
    snapshots: Schema.Struct({
      assessment: Schema.NullOr(Sha256HashSchema),
      program: Schema.NullOr(Sha256HashSchema),
      quran: Schema.NullOr(Sha256HashSchema),
    }),
  })
);
/** Integrity-checked active publication identity returned by Convex. */
export type ActiveContentIdentity = typeof ActiveContentIdentitySchema.Type;
/** Release identity used to bind ownership and body cache entries. */
export type ActiveContentReleaseId =
  NonNullable<ActiveContentIdentity>["releaseId"];
/** A structured family whose answers depend on its own snapshot, not on the release. */
export type ContentSnapshotFamily =
  keyof NonNullable<ActiveContentIdentity>["snapshots"];

/** Store tag of the active release pointer, expired in the isolate that activates a release. */
export const ACTIVE_POINTER_TAG = "content-active";
const ACTIVE_POINTER_PARTS = ["active"];
/**
 * How long an isolate trusts its stored pointer when nothing drops it.
 *
 * The activation route expires the pointer in the isolate that serves it and
 * reads it back to prove the expiry. Every other isolate drops its pointer when
 * this lifetime ends, and every read that finds Convex naming another release
 * than the pointer drops it too. A minute bounds how long an isolate keeps
 * showing the previous release, and it bounds the Convex reads of the pointer
 * to one a minute per isolate, below the 115 thousand a month that the unstored
 * read made. A longer lifetime would save little more and would delay a release
 * longer.
 */
const ACTIVE_POINTER_LIFETIME = Duration.seconds(60);

/**
 * Reads the exact integrity-checked active content release identity from
 * Convex. This read is never stored: the activation route and every release
 * check need the identity as Convex holds it right now.
 */
export const loadActiveContentIdentity = Effect.fn(
  "NakafaContent.loadActiveContentIdentity"
)(function* () {
  const identity = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.runtime.active.read, {})
  ).pipe(Effect.provide(httpLayer()));
  return yield* Schema.decodeEffect(ActiveContentIdentitySchema)(identity);
});

/**
 * Reads the active content release identity that the content store keys every
 * entry by. Each isolate keeps it for a short time, so a document request reads
 * Convex for the pointer once a minute and not once per request.
 */
export const readActiveContentIdentity = Effect.fn(
  "NakafaContent.readActiveContentIdentity"
)(function* () {
  const stored = yield* readStoreEntry({
    parts: ACTIVE_POINTER_PARTS,
    schema: ActiveContentIdentitySchema,
  });
  if (Option.isSome(stored)) {
    return stored.value;
  }
  const identity = yield* loadActiveContentIdentity();
  yield* writeStoreEntry({
    parts: ACTIVE_POINTER_PARTS,
    schema: ActiveContentIdentitySchema,
    tags: [ACTIVE_POINTER_TAG],
    ttl: ACTIVE_POINTER_LIFETIME,
    value: identity,
  });
  return identity;
});

/** Makes this isolate read the active release pointer from Convex again. */
export const expireActiveContentIdentity = Effect.fn(
  "NakafaContent.expireActiveContentIdentity"
)(function* () {
  yield* expireStoreTag(ACTIVE_POINTER_TAG);
});
