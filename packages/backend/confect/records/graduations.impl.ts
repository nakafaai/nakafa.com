import { GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import {
  cohorts,
  get,
  readiness,
  sheet,
} from "@repo/backend/confect/records/graduations/read";
import { decide, issue } from "@repo/backend/confect/records/graduations/write";
import spec from "@repo/backend/confect/records/graduations.spec";
import {
  cohortAccess,
  periodAccess,
} from "@repo/backend/confect/tenancy/authority";
import { Layer } from "effect";

/** The graduation of a unit's last grade: the principal records the decision and issues the SKL. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cohorts),
  Layer.provide(get),
  Layer.provide(sheet),
  Layer.provide(readiness),
  Layer.provide(decide),
  Layer.provide(issue),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(cohortAccess),
  Layer.provide(periodAccess),
  GroupImpl.finalize
);
