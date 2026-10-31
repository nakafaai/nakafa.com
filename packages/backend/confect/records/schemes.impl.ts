import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
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
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

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

/** One page of the school's scheme versions, the newest first, so the first row is the version in force from now. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("records.schemes.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const page = yield* (yield* DatabaseReader)
      .table("gradingSchemes")
      .index(
        "by_tenantId_and_effectiveFrom",
        (query) => query.eq("tenantId", tenant._id),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, {
      page: Arr.map(page.page, (row) => ({
        bands: row.bands,
        effectiveFrom: row.effectiveFrom,
        id: row._id,
        kktp: row.kktp,
      })),
    });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(store),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
