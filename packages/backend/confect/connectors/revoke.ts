import { FunctionImpl } from "@confect/server";
import connectorsInternal from "@repo/backend/confect/_generated/refs/connectors.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { destroySecret } from "@repo/backend/confect/connectors/connection";
import { revokeGrant } from "@repo/backend/confect/connectors/google/oauth";
import { connectionToken } from "@repo/backend/confect/connectors/secret";
import spec from "@repo/backend/confect/connectors/sync.spec";
import { FetchClient } from "@repo/utilities/http/client";
import { Duration, Effect, Option, Schedule } from "effect";

/** How many times a revoke that Google refuses or does not answer is tried again before the token is destroyed anyway. */
const REVOKE_RETRIES = 3;

/**
 * The opened token of an ended connection that waits for its revoke, or null when the connection is still active or
 * its token is gone. Only a disconnect that revokes leaves a disconnected connection with a token.
 */
export const revocable = FunctionImpl.make(
  databaseSchema,
  spec,
  "revocable",
  Effect.fn("connectors.revoke.token")(function* ({ connectionId }) {
    const row = yield* (yield* DatabaseReader)
      .table("connectorConnections")
      .get(connectionId)
      .pipe(Effect.option);
    if (Option.isNone(row) || row.value.status !== "disconnected") {
      return null;
    }
    return Option.getOrNull(yield* connectionToken(row.value));
  })
);

/**
 * Revokes the grant of the last connection of a Google account at Google, then destroys its token (ADR 0015). Google
 * ends every scope the account granted the connectors project. A revoke that Google refuses or does not answer is
 * tried again a few times, and the token is destroyed whatever Google answered, so no token outlives its connection.
 */
export const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("connectors.revoke.run")(function* ({ connectionId }) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const token = yield* runQuery(connectorsInternal.sync.revocable, {
      connectionId,
    }).pipe(Effect.orDie);
    if (token !== null) {
      yield* revokeGrant(token).pipe(
        Effect.retry({
          schedule: Schedule.exponential(Duration.seconds(1)),
          times: REVOKE_RETRIES,
        }),
        Effect.provide(FetchClient),
        Effect.catchTag("GoogleFailed", (failure) =>
          Effect.logWarning("connectors.revoke.refused", failure.reason)
        ),
        Effect.ensuring(
          runMutation(connectorsInternal.sync.destroy, {
            connectionId,
          }).pipe(Effect.orDie)
        )
      );
    }
    return null;
  })
);

/** Destroys the token of an ended connection once its revoke has run. */
export const destroy = FunctionImpl.make(
  databaseSchema,
  spec,
  "destroy",
  Effect.fn("connectors.revoke.destroy")(function* ({ connectionId }) {
    yield* destroySecret(connectionId);
    return null;
  })
);
