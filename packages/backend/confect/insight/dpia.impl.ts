import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import spec from "@repo/backend/confect/insight/dpia.spec";
import { dpiaOf } from "@repo/backend/confect/insight/gate";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Clock, Effect, Layer, Option, Struct } from "effect";

/** The school's impact assessment in force, if one is on record. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("insight.dpia.get")(function* () {
    const { tenant } = yield* Member;
    return Option.getOrNull(
      Option.map(
        yield* dpiaOf(tenant._id),
        Struct.pick(["recordedAt", "reviewer", "version"])
      )
    );
  })
);

/** Records a version of the school's impact assessment, which switches Insight on, and journals it. */
const record = FunctionImpl.make(
  databaseSchema,
  spec,
  "record",
  Effect.fn("insight.dpia.record")(function* ({ reviewer, version }) {
    const { person, tenant } = yield* Member;
    yield* (yield* DatabaseWriter)
      .table("insightDpias")
      .insert({
        recordedAt: yield* Clock.currentTimeMillis,
        recordedBy: person._id,
        reviewer,
        tenantId: tenant._id,
        version,
      })
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      type: "insight.dpia.recorded",
      version,
    });
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(record),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
