import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { destroySecret } from "@repo/backend/confect/connectors/connection";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

const CONNECTION_CLEANUP_BATCH_SIZE = 25;

/**
 * Deletes one bounded batch of a learner's personal connections: each one's sealed
 * token, then the connection. It runs before the learner key is shredded, because
 * the grant at Google can be revoked only with the token, which that key opens.
 * Revoking each grant waits for the connector adapter (ADR 0015).
 */
export const cleanupUserConnections = Effect.fn(
  "auth.cleanup.cleanupUserConnections"
)(
  function* (userId: Id<"users">) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const connections = yield* reader
      .table("connectorConnections")
      .index("by_userId_and_status", (query) =>
        query.eq("owner.userId", userId)
      )
      .take(CONNECTION_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const connection of connections) {
      yield* destroySecret(connection._id);
      yield* writer
        .table("connectorConnections")
        .delete(connection._id)
        .pipe(Effect.orDie);
    }
    return connections.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
