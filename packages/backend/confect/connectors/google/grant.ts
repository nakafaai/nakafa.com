import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { readGoogleClient } from "@repo/backend/confect/connectors/google/client";
import { refreshAccess } from "@repo/backend/confect/connectors/google/oauth";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Option } from "effect";

/**
 * A fresh access token of the account's active Drive connection, or none when it
 * has none. A token that Google no longer accepts moves the connection to
 * `reconnect` and fails as `revoked`. The token lasts about an hour, and nothing
 * stores it.
 */
export const ownDriveAccess = Effect.fn("connectors.google.driveAccess")(
  function* (userId: GenericId.GenericId<"users">) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const target = yield* runQuery(refs.internal.connectors.drive.ownTarget, {
      userId,
    }).pipe(Effect.orDie);
    if (target === null) {
      return Option.none();
    }
    const client = yield* readGoogleClient("drive");
    const accessToken = yield* refreshAccess(client, target.refreshToken).pipe(
      Effect.provide(FetchClient),
      Effect.tapError((failure) =>
        failure.reason === "revoked"
          ? runMutation(refs.internal.connectors.sync.reconnect, {
              connectionId: target.connectionId,
            }).pipe(Effect.orDie)
          : Effect.void
      )
    );
    return Option.some(accessToken);
  }
);
