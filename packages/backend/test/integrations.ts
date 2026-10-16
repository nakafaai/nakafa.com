import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ClientPrincipal } from "@repo/backend/confect/access/principal";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import type {
  ClientActions,
  IntegrationStatus,
} from "@repo/backend/confect/integrations/schema";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

/**
 * Inserts one integration client of a tenant and returns it as the school API
 * principal holds it: the client and its tenant. An active client holds a
 * placeholder digest and a revoked one holds none, as the registry writes them.
 */
export const clientPrincipal = Effect.fn("test.integrations.clientPrincipal")(
  function* (
    tenantId: GenericId.GenericId<"tenants">,
    fields: {
      actions: typeof ClientActions.Type;
      scope: GrantScope;
      status: typeof IntegrationStatus.Type;
    }
  ) {
    const reader = yield* DatabaseReader;
    const clientId = yield* (yield* DatabaseWriter)
      .table("integrationClients")
      .insert({
        actions: fields.actions,
        name: "Sinkron Harapan",
        revokedAt: fields.status === "revoked" ? TENANCY_NOW : null,
        rotatedAt: TENANCY_NOW,
        scope: fields.scope,
        secretHash: fields.status === "active" ? "0".repeat(64) : null,
        status: fields.status,
        tenantId,
      });
    return yield* Schema.decodeEffect(ClientPrincipal)({
      client: yield* reader
        .table("integrationClients")
        .get(clientId)
        .pipe(Effect.orDie),
      tenant: yield* reader.table("tenants").get(tenantId).pipe(Effect.orDie),
    }).pipe(Effect.orDie);
  }
);
