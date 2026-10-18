import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ConnectionAccess } from "@repo/backend/confect/connectors/access";
import { ConnectionView } from "@repo/backend/confect/connectors/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The connections of a school and of an account. A school's Owner and Admin list
 * and disconnect its connections. An account lists and disconnects its own, and
 * never another's. A list is paginated.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "listSchool",
      args: () => ({ slug: TenantSlug }),
      item: () => ConnectionView,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "connection.view" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "listOwn",
      args: () => ({}),
      item: () => ConnectionView,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "disconnectSchool",
      args: () => ({
        connectionId: Id("connectorConnections"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ConnectionAccess, {
        action: "connection.manage",
        arg: "connectionId",
      })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "disconnectOwn",
      args: () => ({ connectionId: Id("connectorConnections") }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, AuthFailure]),
    }).middleware(Session)
  );
