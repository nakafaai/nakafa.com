import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Authority } from "@repo/backend/confect/access/policy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import {
  Integration,
  IntegrationAccess,
} from "@repo/backend/confect/integrations/access";
import { integration } from "@repo/backend/confect/integrations/kinds";
import { Effect } from "effect";

/** A revoked client is ended and locked; a unit client belongs to its unit. */
export const integrationAuthority = Authority.make(
  integration,
  Authority.load(integration),
  {
    place: (row) =>
      Effect.succeed({
        locked: row.status === "revoked",
        units: GrantScope.match(row.scope, {
          tenant: () => [],
          unit: ({ unitId }) => [unitId],
        }),
      }),
    relations: {},
    tenantOf: (row) => row.tenantId,
  }
);

/**
 * Implements the `IntegrationAccess` check: it authorizes the action on the
 * client whose ID the named argument holds, and provides that client.
 */
export const integrationAccess = MiddlewareImpl.make(
  databaseSchema,
  IntegrationAccess,
  integrationAuthority.middleware(Integration)
);
