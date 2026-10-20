import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  auditHandler,
  CohortInput,
  clientsHandler,
  cohortHandler,
  cohortsHandler,
  invitesHandler,
  membersHandler,
  periodsHandler,
  rolesHandler,
  SchoolInput,
  SettingsListInput,
  studentsHandler,
  UnitInput,
  UnitScopeInput,
  unitsHandler,
} from "@/lib/tenant/settings.server";

/** The units of the school, which the units tab and the unit choice read first. */
export const readUnitsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SchoolInput))
  .handler(unitsHandler);

/** The first page of the school's students. */
export const readStudentsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(studentsHandler);

/** The first page of the school's role grants. */
export const readRolesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(rolesHandler);

/** The first page of the school's members. */
export const readMembersFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(membersHandler);

/** The first page of the school's invites. */
export const readInvitesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(invitesHandler);

/** The first page of the school's integration clients. */
export const readClientsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(clientsHandler);

/** The first page of the audit journal and its people. */
export const readAuditFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(auditHandler);

/** The first page of one unit's periods. */
export const readPeriodsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(UnitScopeInput))
  .handler(periodsHandler);

/** One unit's active period and its cohorts. */
export const readCohortsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(UnitInput))
  .handler(cohortsHandler);

/** One cohort, its members, and the cohorts of its period. */
export const readCohortFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CohortInput))
  .handler(cohortHandler);
