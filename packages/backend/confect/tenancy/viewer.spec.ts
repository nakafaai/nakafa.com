import { FunctionSpec, GroupSpec } from "@confect/core";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantCapabilities } from "@repo/backend/confect/access/catalog";
import { GrantView } from "@repo/backend/confect/access/schema";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TimeZone } from "@repo/backend/confect/tenancy/locale";
import {
  PersonKind,
  PersonName,
  TenantProfile,
  TenantSettings,
  UnitLevel,
  UnitName,
  UnitStatus,
  ViewerAccount,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema, Struct } from "effect";

/** Everything the School shell needs to render for the caller in one tenant. */
const ViewerView = Schema.Struct({
  account: ViewerAccount,
  can: TenantCapabilities,
  grants: Schema.Array(GrantView),
  person: Schema.Struct({
    id: Id("tenantPeople"),
    kind: PersonKind,
    name: PersonName,
  }),
  tenant: TenantProfile.mapFields(
    Struct.assign({ id: Id("tenants"), ...TenantSettings.fields })
  ),
  units: Schema.Array(
    Schema.Struct({
      contentLanguage: AppLocaleCodeSchema,
      id: Id("tenantUnits"),
      level: UnitLevel,
      name: UnitName,
      status: UnitStatus,
      timeZone: TimeZone,
    })
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
      error: () => Schema.Union([AccountUnavailable, SessionRequired]),
    }).middleware(TenantAccess, { action: "tenant.view" })
  );
