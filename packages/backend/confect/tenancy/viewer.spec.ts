import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantCapabilities } from "@repo/backend/confect/access/catalog";
import { GrantView } from "@repo/backend/confect/access/schema";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  PersonKind,
  PersonName,
  TenantProfile,
  UnitLevel,
  UnitName,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema, Struct } from "effect";

/** Everything the School shell needs to render for the caller in one tenant. */
const ViewerView = Schema.Struct({
  can: TenantCapabilities,
  grants: Schema.Array(GrantView),
  person: Schema.Struct({
    id: Id("tenantPeople"),
    kind: PersonKind,
    name: PersonName,
  }),
  tenant: TenantProfile.mapFields(Struct.assign({ id: Id("tenants") })),
  units: Schema.Array(
    Schema.Struct({ id: Id("tenantUnits"), level: UnitLevel, name: UnitName })
  ),
});

export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ slug: TenantSlug }),
      returns: () => ViewerView,
    }).middleware(TenantAccess, { action: "tenant.view" })
  );
