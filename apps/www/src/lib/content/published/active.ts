import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Duration, Effect, Option, Schema } from "effect";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import {
  expireStoreTag,
  readStoreEntry,
  writeStoreEntry,
} from "@/lib/content/store/entry";
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

/** Store tag of the active release pointer, expired when a release goes live. */
const ACTIVE_POINTER_TAG = "content-active";
const ACTIVE_POINTER_PARTS = ["active"];
/**
 * How long a region trusts its stored pointer when nothing drops it.
 *
 * The activation route expires the pointer the moment a release goes live and
 * reads it back to prove the expiry, because the Runtime Cache client logs a
 * failed expiry and resolves. Every read that finds Convex naming another
 * release than the pointer drops it too. This lifetime covers what is left: a
 * read that began before the activation and writes the previous pointer after
 * the expiry. A minute bounds how long a region keeps showing the previous
 * release, and it bounds the Convex reads of the pointer to one a minute per
 * region, below the 115 thousand a month that the unstored read made. A longer
 * lifetime would save little more and would delay a release longer.
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
 * entry by. Each region keeps it for a short time, so a document request reads
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
    name: "content.active",
    parts: ACTIVE_POINTER_PARTS,
    schema: ActiveContentIdentitySchema,
    tags: [ACTIVE_POINTER_TAG],
    ttl: ACTIVE_POINTER_LIFETIME,
    value: identity,
  });
  return identity;
});

/** Makes every region read the active release pointer from Convex again. */
export const expireActiveContentIdentity = Effect.fn(
  "NakafaContent.expireActiveContentIdentity"
)(function* () {
  yield* expireStoreTag(ACTIVE_POINTER_TAG);
});

/**
 * Proves that the stored pointer names the release that was just activated.
 *
 * The Runtime Cache client logs an expiry that failed or timed out and
 * resolves, so a call to `expireActiveContentIdentity` cannot tell the caller
 * that it did nothing. Reading the pointer back can: it must now name
 * `releaseId`, and the read stores the fresh pointer for the next reader. A
 * pointer that still names the previous release fails with the mismatch, so
 * the activation route can answer 503 before it revalidates anything, and the
 * publisher repeats the call.
 */
export const confirmActiveContentIdentity = Effect.fn(
  "NakafaContent.confirmActiveContentIdentity"
)(function* (releaseId: ActiveContentReleaseId) {
  const stored = yield* readActiveContentIdentity();
  if (stored?.releaseId !== releaseId) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: stored?.releaseId ?? null,
      expectedReleaseId: releaseId,
    });
  }
});
