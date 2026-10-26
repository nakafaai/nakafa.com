import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { IntegrationAccess } from "@repo/backend/confect/integrations/access";
import { DeviceUnknown } from "@repo/backend/confect/integrations/errors";
import {
  DevicePoll,
  DeviceStart,
} from "@repo/backend/confect/integrations/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** A user code as a person types it, dash and spaces included. */
const TypedCode = Schema.String.check(Schema.isMaxLength(20));

/**
 * The device grant of the school API (RFC 8628, ADR 0029): the CLI starts an authorization
 * and polls it through the token endpoint, and the school's Admin authorizes it for one
 * integration client on the clients page, or denies it. `start`, `poll`, and `sweep` are
 * internal: only the HTTP routes and the cron call them.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "start",
      args: () => ({ slug: TenantSlug }),
      returns: () => DeviceStart,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "poll",
      args: () => ({ deviceCode: Schema.String }),
      returns: () => DevicePoll,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "authorize",
      args: () => ({
        clientId: Id("integrationClients"),
        slug: TenantSlug,
        userCode: TypedCode,
      }),
      returns: () => Schema.Struct({}),
      error: () => Schema.Union([AccessDenied, DeviceUnknown]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(IntegrationAccess, {
        action: "integration.manage",
        arg: "clientId",
      })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deny",
      args: () => ({ slug: TenantSlug, userCode: TypedCode }),
      returns: () => Schema.Struct({}),
      error: () => Schema.Union([AccessDenied, DeviceUnknown]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "integration.manage" })
  );
