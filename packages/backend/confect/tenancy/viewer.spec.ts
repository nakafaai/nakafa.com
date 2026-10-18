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
  TenantName,
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

/** One school the account is an active member of: its name, its address, and the mark the account menu draws. */
const SchoolListItem = Schema.Struct({
  mark: TenantProfile.mapFields(Struct.pick(["logo", "mascot"])),
  name: TenantName,
  slug: TenantSlug,
});

/**
 * The member's view of one school, and the schools the caller belongs to. The
 * member check belongs to `get` alone, because `schools` names no school.
 */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ slug: TenantSlug }),
      returns: () => ViewerView,
      error: () => Schema.Union([AccountUnavailable, SessionRequired]),
    })
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "tenant.view" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "schools",
      returns: () => Schema.Array(SchoolListItem),
      error: () => Schema.Union([AccountUnavailable, SessionRequired]),
    })
  );
