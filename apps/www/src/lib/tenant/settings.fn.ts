import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  CohortInput,
  SchoolInput,
  SettingsListInput,
  UnitInput,
  UnitScopeInput,
} from "@/lib/tenant/settings";

/** The units of the school, which the units tab and the unit choice read first. */
export const readUnitsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SchoolInput))
  .handler(async (options) => {
    const { unitsHandler } = await import("@/lib/tenant/settings.server");
    return unitsHandler(options);
  });

/** The first page of the school's students. */
export const readStudentsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(async (options) => {
    const { studentsHandler } = await import("@/lib/tenant/settings.server");
    return studentsHandler(options);
  });

/** The first page of the school's role grants. */
export const readRolesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(async (options) => {
    const { rolesHandler } = await import("@/lib/tenant/settings.server");
    return rolesHandler(options);
  });

/** The first page of the school's members. */
export const readMembersFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(async (options) => {
    const { membersHandler } = await import("@/lib/tenant/settings.server");
    return membersHandler(options);
  });

/** The first page of the school's invites. */
export const readInvitesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(async (options) => {
    const { invitesHandler } = await import("@/lib/tenant/settings.server");
    return invitesHandler(options);
  });

/** The first page of the school's integration clients. */
export const readClientsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(async (options) => {
    const { clientsHandler } = await import("@/lib/tenant/settings.server");
    return clientsHandler(options);
  });

/** The first page of the audit journal and its people. */
export const readAuditFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(async (options) => {
    const { auditHandler } = await import("@/lib/tenant/settings.server");
    return auditHandler(options);
  });

/** The first page of one unit's periods. */
export const readPeriodsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(UnitScopeInput))
  .handler(async (options) => {
    const { periodsHandler } = await import("@/lib/tenant/settings.server");
    return periodsHandler(options);
  });

/** One unit's active period and its cohorts. */
export const readCohortsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(UnitInput))
  .handler(async (options) => {
    const { cohortsHandler } = await import("@/lib/tenant/settings.server");
    return cohortsHandler(options);
  });

/** One cohort, its members, and the cohorts of its period. */
export const readCohortFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CohortInput))
  .handler(async (options) => {
    const { cohortHandler } = await import("@/lib/tenant/settings.server");
    return cohortHandler(options);
  });
