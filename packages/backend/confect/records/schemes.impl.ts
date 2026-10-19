import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { SchemeNotLater } from "@repo/backend/confect/records/errors";
import { normalizeScheme } from "@repo/backend/confect/records/scheme";
import spec from "@repo/backend/confect/records/schemes.spec";
import { newestVersion } from "@repo/backend/confect/records/version";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Effect, Layer, Option } from "effect";

/**
 * Stores one version of the school's grading scheme, which takes effect on its
 * date. The date must come after the newest version's, or the version would never
 * be in force. The bands are stored in their order, and the journal entry holds the
 * version's ID alone.
 */
const store = FunctionImpl.make(
  databaseSchema,
  spec,
  "store",
  Effect.fn("records.schemes.store")(function* ({
    bands,
    effectiveFrom,
    kktp,
  }) {
    const { person, tenant } = yield* Member;
    const newest = yield* newestVersion(tenant._id);
    if (Option.exists(newest, (row) => effectiveFrom <= row.effectiveFrom)) {
      return yield* new SchemeNotLater();
    }
    const scheme = normalizeScheme({ bands, kktp });
    const id = yield* (yield* DatabaseWriter)
      .table("gradingSchemes")
      .insert({
        bands: scheme.bands,
        effectiveFrom,
        kktp: scheme.kktp,
        tenantId: tenant._id,
      })
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      scheme: id,
      type: "scheme.stored",
    });
    return { bands: scheme.bands, effectiveFrom, id, kktp: scheme.kktp };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(store),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
