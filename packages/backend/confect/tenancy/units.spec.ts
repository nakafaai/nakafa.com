import { FunctionSpec, GroupSpec } from "@confect/core";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  NpsnInvalid,
  NpsnTaken,
  UnitLimit,
} from "@repo/backend/confect/tenancy/errors";
import { NewTimeZone, TimeZone } from "@repo/backend/confect/tenancy/locale";
import {
  Npsn,
  UnitLevel,
  UnitName,
  UnitStatus,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One unit of the school as its Admin reads it, with its national school number. */
const UnitView = Schema.Struct({
  contentLanguage: AppLocaleCodeSchema,
  id: Id("tenantUnits"),
  level: UnitLevel,
  name: UnitName,
  npsn: Schema.NullOr(Npsn),
  status: UnitStatus,
  timeZone: TimeZone,
});

/**
 * What an Owner or an Admin changes for one school of the organisation. Each
 * mutation answers with the value now stored, so a screen that showed the
 * change first can confirm it, and a refusal is a typed denial that the screen
 * undoes the change on.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(UnitView),
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setNpsn",
      args: () => ({
        npsn: Schema.String,
        slug: TenantSlug,
        unitId: Id("tenantUnits"),
      }),
      returns: () => Npsn,
      error: () => Schema.Union([AccessDenied, NpsnInvalid, NpsnTaken]),
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setLocale",
      args: () => ({
        contentLanguage: AppLocaleCodeSchema,
        slug: TenantSlug,
        timeZone: NewTimeZone,
        unitId: Id("tenantUnits"),
      }),
      returns: () =>
        Schema.Struct({
          contentLanguage: AppLocaleCodeSchema,
          timeZone: TimeZone,
        }),
      error: () => AccessDenied,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        contentLanguage: AppLocaleCodeSchema,
        level: UnitLevel,
        name: UnitName,
        slug: TenantSlug,
        timeZone: NewTimeZone,
      }),
      returns: () => UnitView,
      error: () => Schema.Union([AccessDenied, UnitLimit]),
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "archive",
      args: () => ({ slug: TenantSlug, unitId: Id("tenantUnits") }),
      returns: () => UnitStatus,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unarchive",
      args: () => ({ slug: TenantSlug, unitId: Id("tenantUnits") }),
      returns: () => UnitStatus,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  );
