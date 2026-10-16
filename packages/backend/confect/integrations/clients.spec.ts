import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { IntegrationAccess } from "@repo/backend/confect/integrations/access";
import { ActionClosed } from "@repo/backend/confect/integrations/errors";
import {
  ClientActions,
  IntegrationName,
  IntegrationStatus,
} from "@repo/backend/confect/integrations/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One integration client as its school's list shows it. Its secret hash never leaves the server. */
const ClientView = Schema.Struct({
  actions: ClientActions,
  createdAt: Schema.Finite,
  id: Id("integrationClients"),
  name: IntegrationName,
  revokedAt: Schema.NullOr(Schema.Finite),
  rotatedAt: Schema.Finite,
  scope: GrantScope,
  status: IntegrationStatus,
});

/** A client's secret, returned once to the caller that created or rotated it. */
const IssuedClient = Schema.Struct({
  id: Id("integrationClients"),
  secret: Schema.String,
});

/**
 * The integration clients of one school. Its Owner and Admin create, rotate,
 * and revoke them, and list them. A client's secret is shown once.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () => ClientView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "integration.view" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        actions: ClientActions,
        name: IntegrationName,
        scope: GrantScope,
        slug: TenantSlug,
      }),
      returns: () => IssuedClient,
      error: () => Schema.Union([AccessDenied, ActionClosed]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rotate",
      args: () => ({ clientId: Id("integrationClients"), slug: TenantSlug }),
      returns: () => IssuedClient,
      error: () => AccessDenied,
    }).middleware(IntegrationAccess, {
      action: "integration.manage",
      arg: "clientId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "revoke",
      args: () => ({ clientId: Id("integrationClients"), slug: TenantSlug }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(IntegrationAccess, {
      action: "integration.view",
      arg: "clientId",
    })
  );
