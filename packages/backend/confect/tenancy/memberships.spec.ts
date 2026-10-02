import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  PersonName,
  TenantProfile,
} from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/** The caller's own tenants for the School switcher; identity scoped, never cross-tenant. */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      item: () =>
        Schema.Struct({
          person: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
          tenant: TenantProfile,
        }),
      error: () => Schema.Union([SessionRequired, AccountUnavailable]),
    })
  );
