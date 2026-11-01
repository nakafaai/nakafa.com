import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import {
  SchemeNotLater,
  SchemeUsed,
} from "@repo/backend/confect/records/errors";
import { normalizeScheme } from "@repo/backend/confect/records/scheme";
import spec from "@repo/backend/confect/records/schemes.spec";
import { newestVersion } from "@repo/backend/confect/records/version";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Effect, Layer, Option, Struct } from "effect";

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
    return {
      bands: scheme.bands,
      effectiveFrom,
      id,
      kktp: scheme.kktp,
      used: false,
    };
  })
);

/** Whether a stored version has judged a grade. */
const hasJudged = Effect.fn("records.schemes.hasJudged")(function* (
  schemeId: GenericId.GenericId<"gradingSchemes">
) {
  const grade = yield* (yield* DatabaseReader)
    .table("classGrades")
    .index("by_schemeId", (query) => query.eq("schemeId", schemeId))
    .first()
    .pipe(Effect.orDie);
  return Option.isSome(grade);
});

/** The school's version a call names, while it has judged no grade. */
const unusedVersion = Effect.fn("records.schemes.unused")(function* (
  schemeId: GenericId.GenericId<"gradingSchemes">
) {
  const { tenant } = yield* Member;
  const row = yield* (yield* DatabaseReader)
    .table("gradingSchemes")
    .get(schemeId)
    .pipe(Effect.option);
  if (Option.isNone(row) || row.value.tenantId !== tenant._id) {
    return yield* new AccessDenied({
      action: "scheme.manage",
      reason: "resource",
    });
  }
  if (yield* hasJudged(schemeId)) {
    return yield* new SchemeUsed();
  }
  return row.value;
});

/** Corrects a version that has judged no grade: its KKTP and its bands. Its date stays. */
const amend = FunctionImpl.make(
  databaseSchema,
  spec,
  "amend",
  Effect.fn("records.schemes.amend")(function* ({ bands, kktp, schemeId }) {
    const { person, tenant } = yield* Member;
    const row = yield* unusedVersion(schemeId);
    const scheme = normalizeScheme({ bands, kktp });
    const amended = Struct.assign(row, {
      bands: scheme.bands,
      kktp: scheme.kktp,
    });
    yield* (yield* DatabaseWriter)
      .table("gradingSchemes")
      .replace(row._id, Struct.omit(amended, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      scheme: row._id,
      type: "scheme.amended",
    });
    return {
      bands: amended.bands,
      effectiveFrom: amended.effectiveFrom,
      id: row._id,
      kktp: amended.kktp,
      used: false,
    };
  })
);

/** Removes a version that has judged no grade. The next newest version is in force again. */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("records.schemes.remove")(function* ({ schemeId }) {
    const { person, tenant } = yield* Member;
    const row = yield* unusedVersion(schemeId);
    yield* (yield* DatabaseWriter)
      .table("gradingSchemes")
      .delete(row._id)
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      scheme: row._id,
      type: "scheme.removed",
    });
    return null;
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
      page: yield* Effect.forEach(page.page, (row) =>
        Effect.map(hasJudged(row._id), (used) => ({
          bands: row.bands,
          effectiveFrom: row.effectiveFrom,
          id: row._id,
          kktp: row.kktp,
          used,
        }))
      ),
    });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(store),
  Layer.provide(amend),
  Layer.provide(remove),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
