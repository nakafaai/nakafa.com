import { GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { reportAccess } from "@repo/backend/confect/records/authority";
import {
  cohorts,
  get,
  sheet,
} from "@repo/backend/confect/records/reports/read";
import {
  approve,
  complete,
  reopen,
  write,
} from "@repo/backend/confect/records/reports/write";
import spec from "@repo/backend/confect/records/reports.spec";
import { cohortAccess } from "@repo/backend/confect/tenancy/authority";
import { Layer } from "effect";

/** The report cards of a cohort: the homeroom teacher writes and hands them in, and the principal approves them. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cohorts),
  Layer.provide(sheet),
  Layer.provide(get),
  Layer.provide(write),
  Layer.provide(complete),
  Layer.provide(reopen),
  Layer.provide(approve),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(cohortAccess),
  Layer.provide(reportAccess),
  GroupImpl.finalize
);
