import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import MiddlewareSession from "@repo/backend/confect/middleware/session.spec";
import {
  NotOperator,
  OwnerClaimed,
} from "@repo/backend/confect/operators/errors";
import { TenantRow } from "@repo/backend/confect/operators/schema";
import {
  InviteDomainRefused,
  ProvisionRejected,
  TenantNotFound,
} from "@repo/backend/confect/tenancy/errors";
import {
  openArgs,
  openResult,
} from "@repo/backend/confect/tenancy/provision.spec";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * The operator console's commands on schools: open one, suspend it, reactivate
 * it, replace its unclaimed Owners as a break-glass, and list every school of
 * this deployment. Each one checks that the caller is an active operator.
 */
export default GroupSpec.make()
  .middleware(MiddlewareSession)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => openArgs,
      returns: () => openResult,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotOperator,
          ProvisionRejected,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "suspend",
      args: () => ({ tenantId: Id("tenants") }),
      returns: () => TenantRow,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotOperator,
          TenantNotFound,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reactivate",
      args: () => ({ tenantId: Id("tenants") }),
      returns: () => TenantRow,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotOperator,
          TenantNotFound,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "replaceOwner",
      args: () => ({
        locale: ActiveAppLocaleCodeSchema,
        owner: Schema.Struct({ email: Email, name: PersonName }),
        tenantId: Id("tenants"),
      }),
      returns: () => TenantRow,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          InviteDomainRefused,
          NotOperator,
          OwnerClaimed,
          TenantNotFound,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({}),
      item: () => TenantRow,
      error: () =>
        Schema.Union([SessionRequired, AccountUnavailable, NotOperator]),
    })
  );
