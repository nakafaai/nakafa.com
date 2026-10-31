import type { GenericId } from "@confect/core";
import type { IntegrationClientsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { opensTo } from "@repo/backend/confect/access/catalog";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { integrationAuthority } from "@repo/backend/confect/integrations/authority";
import { ActionClosed } from "@repo/backend/confect/integrations/errors";
import type {
  ClientActions,
  IntegrationName,
} from "@repo/backend/confect/integrations/schema";
import { endClientTokens } from "@repo/backend/confect/integrations/token";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  tenantAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { issueToken } from "@repo/utilities/token";
import { Array as Arr, Clock, Effect, Struct } from "effect";

/** One integration client as the school's list shows it. Its secret hash never leaves the server. */
export const view = (client: IntegrationClientsDoc) => ({
  actions: client.actions,
  createdAt: client._creationTime,
  id: client._id,
  name: client.name,
  revokedAt: client.revokedAt,
  rotatedAt: client.rotatedAt,
  scope: client.scope,
  status: client.status,
});

/** Refuses an action list that names an action the catalog does not open to the Integration role. */
export const requireOpenActions = Effect.fn("integrations.client.open")(
  function* (actions: typeof ClientActions.Type) {
    if (Arr.some(actions, (action) => !opensTo(action, "integration"))) {
      return yield* new ActionClosed();
    }
  }
);

/**
 * Creating a client needs `integration.manage` on the scope it covers, as
 * giving a role needs `grant.manage`: the tenant for a tenant-wide client, the
 * unit for a unit client.
 */
export const authorizeScope = Effect.fn("integrations.client.scope")(function* (
  scope: GrantScope
) {
  const { tenant } = yield* Member;
  yield* GrantScope.match(scope, {
    tenant: () => tenantAuthority.check("integration.manage", tenant),
    unit: ({ unitId }) =>
      Effect.asVoid(unitAuthority.authorize("integration.manage", unitId)),
  });
});

/**
 * Registers a client of one tenant. Its secret is drawn now and shown once: the
 * registry keeps only its digest. The journal records the client and its scope.
 */
export const register = Effect.fn("integrations.client.register")(function* (
  actor: typeof TenantActor.Type,
  tenantId: GenericId.GenericId<"tenants">,
  input: {
    actions: typeof ClientActions.Type;
    name: typeof IntegrationName.Type;
    scope: GrantScope;
  }
) {
  const { hash, token: secret } = yield* issueToken();
  const at = yield* Clock.currentTimeMillis;
  const clientId = yield* (yield* DatabaseWriter)
    .table("integrationClients")
    .insert({
      actions: input.actions,
      name: input.name,
      revokedAt: null,
      rotatedAt: at,
      scope: input.scope,
      secretHash: hash,
      status: "active",
      tenantId,
    })
    .pipe(Effect.orDie);
  const client = yield* (yield* DatabaseReader)
    .table("integrationClients")
    .get(clientId)
    .pipe(Effect.orDie);
  yield* integrationAuthority.record(actor, client, {
    client: clientId,
    scope: client.scope,
    type: "integration.created",
  });
  return { id: clientId, secret };
});

/**
 * Draws a new secret for an active client and stores its digest, so the digest
 * of the old secret is gone at once, and deletes the client's access tokens, so
 * a token issued for the old secret stops working too. The secret is shown once.
 */
export const rotateSecret = Effect.fn("integrations.client.rotate")(function* (
  actor: typeof TenantActor.Type,
  client: IntegrationClientsDoc
) {
  const { hash, token: secret } = yield* issueToken();
  const at = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("integrationClients")
    .replace(
      client._id,
      Struct.assign(Struct.omit(client, ["_creationTime", "_id"]), {
        rotatedAt: at,
        secretHash: hash,
      })
    )
    .pipe(Effect.orDie);
  yield* endClientTokens(client._id);
  yield* integrationAuthority.record(actor, client, {
    client: client._id,
    type: "integration.rotated",
  });
  return { id: client._id, secret };
});

/**
 * Revokes an active client. It holds no secret from now on: its digest and its
 * access tokens are deleted with the revocation (ADR 0029). The caller checks
 * that the client is active.
 */
export const revokeClient = Effect.fn("integrations.client.revoke")(function* (
  actor: typeof TenantActor.Type,
  client: IntegrationClientsDoc
) {
  yield* integrationAuthority.check("integration.manage", client);
  const at = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("integrationClients")
    .replace(client._id, {
      actions: client.actions,
      name: client.name,
      revokedAt: at,
      rotatedAt: client.rotatedAt,
      scope: client.scope,
      secretHash: null,
      status: "revoked",
      tenantId: client.tenantId,
    })
    .pipe(Effect.orDie);
  yield* endClientTokens(client._id);
  yield* integrationAuthority.record(actor, client, {
    client: client._id,
    type: "integration.revoked",
  });
});
