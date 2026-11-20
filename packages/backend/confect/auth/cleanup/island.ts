import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

const GRANT_BATCH_SIZE = 50;
/** A chunk row packs about 2 KB of points beside its things. */
const CHUNK_BATCH_SIZE = 50;
const GUEST_BATCH_SIZE = 50;

/**
 * Deletes one bounded batch of what a deleted account left in the game: the
 * chunks of its world (ADR 0050, W3), the guest book of its world and the
 * stickers it left in other worlds (W6), its ledger, and then its island (ADR
 * 0042, D7). Answers whether anything was deleted, so the cleanup runs again
 * until nothing of the island is left.
 */
export const cleanupUserIsland = Effect.fn("auth.cleanup.cleanupUserIsland")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const chunks = yield* database
      .table("islandChunks")
      .index("by_userId_and_cx_and_cz", (query) => query.eq("userId", userId))
      .take(CHUNK_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const chunk of chunks) {
      yield* writer.table("islandChunks").delete(chunk._id);
    }
    if (chunks.length > 0) {
      return true;
    }
    const guests = yield* database
      .table("islandGuests")
      .index("by_userId_and_at", (query) => query.eq("userId", userId))
      .take(GUEST_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const guest of guests) {
      yield* writer.table("islandGuests").delete(guest._id);
    }
    if (guests.length > 0) {
      return true;
    }
    const visits = yield* database
      .table("islandGuests")
      .index("by_visitorId", (query) => query.eq("visitorId", userId))
      .take(GUEST_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const visit of visits) {
      yield* writer.table("islandGuests").delete(visit._id);
    }
    if (visits.length > 0) {
      return true;
    }
    const grants = yield* database
      .table("islandAwards")
      .index("by_userId_and_key", (query) => query.eq("userId", userId))
      .take(GRANT_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const grant of grants) {
      yield* writer.table("islandAwards").delete(grant._id);
    }
    if (grants.length > 0) {
      return true;
    }
    const islands = yield* database
      .table("islands")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(1)
      .pipe(Effect.orDie);
    for (const island of islands) {
      yield* writer.table("islands").delete(island._id);
    }
    return islands.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
