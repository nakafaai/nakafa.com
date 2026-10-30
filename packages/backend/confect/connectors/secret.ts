import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Space } from "@repo/backend/confect/space";
import {
  ensureLearnerKeys,
  readLearnerKeys,
  readTenantKeys,
} from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Option } from "effect";

/**
 * The stored field that a connection's sealed refresh token belongs to. The row
 * names the connection, so a token copied to another connection never opens.
 */
const refreshTokenField = (
  connectionId: GenericId.GenericId<"connectorConnections">
) =>
  ({
    field: "refreshToken",
    row: [connectionId],
    table: "connectorSecrets",
  }) satisfies typeof VaultField.Type;

/**
 * Seals a connection's refresh token under its owner's key: the school's key for a
 * school connection and the learner's key for a personal one. A learner gets a key
 * on first use, as a chat share does. A sealed token opens only for that owner and
 * that connection (ADR 0030).
 */
export const sealRefreshToken = Effect.fn("connectors.secret.seal")(function* (
  owner: Space,
  connectionId: GenericId.GenericId<"connectorConnections">,
  token: string
) {
  const keys = yield* Space.match(owner, {
    personal: ({ userId }) => ensureLearnerKeys(userId),
    tenant: ({ tenantId }) => readTenantKeys(tenantId),
  });
  return yield* sealText(keys, refreshTokenField(connectionId), token);
});

/**
 * Opens a connection's refresh token with its owner's key. It fails with reason
 * `cipher` when the token was sealed for another owner or another connection, and
 * with reason `key` when the owner has no key.
 */
export const openRefreshToken = Effect.fn("connectors.secret.open")(function* (
  owner: Space,
  connectionId: GenericId.GenericId<"connectorConnections">,
  sealed: ArrayBuffer
) {
  const keys = yield* Space.match(owner, {
    personal: ({ userId }) => readLearnerKeys(userId),
    tenant: ({ tenantId }) => readTenantKeys(tenantId),
  });
  return yield* openText(keys, refreshTokenField(connectionId), sealed);
});

/**
 * The opened refresh token of a stored connection, or none when its token is
 * gone. A token that does not open is a defect: only `connect` seals one.
 */
export const connectionToken = Effect.fn("connectors.secret.token")(
  function* (connection: {
    readonly _id: GenericId.GenericId<"connectorConnections">;
    readonly owner: Space;
  }) {
    const secret = yield* (yield* DatabaseReader)
      .table("connectorSecrets")
      .index("by_connectionId", (query) =>
        query.eq("connectionId", connection._id)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(secret)) {
      return Option.none<string>();
    }
    return Option.some(
      yield* openRefreshToken(
        connection.owner,
        connection._id,
        secret.value.refreshToken
      ).pipe(Effect.orDie)
    );
  }
);
