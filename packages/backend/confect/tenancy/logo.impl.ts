import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import {
  deleteFile,
  fileAddress,
  reserveUpload,
} from "@repo/backend/confect/bucket/file";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import spec from "@repo/backend/confect/tenancy/logo.spec";
import {
  LOGO_BYTE_LIMIT,
  LogoRefused,
  LogoReserved,
  LogoSet,
} from "@repo/backend/confect/tenancy/schema";
import { Effect, Layer, Option, Struct } from "effect";

/**
 * Reserves a logo file: a file over the logo limit is refused before any byte moves, and any other charges the
 * school's bytes and answers the R2 address it is uploaded to, which binds its length and type.
 */
const reserve = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserve",
  Effect.fn("tenancy.logo.reserve")(function* ({ byteSize, contentType }) {
    const { tenant } = yield* Member;
    if (byteSize > LOGO_BYTE_LIMIT) {
      return LogoRefused.make({ reason: "size" });
    }
    const reserved = yield* reserveUpload({
      byteSize,
      contentType,
      tenantId: tenant._id,
    });
    return LogoReserved.make(reserved);
  })
);

/** The address of the school's new logo, which it reads back at once. */
const shownLogo = Effect.fn("tenancy.logo.shown")(function* (
  fileId: GenericId.GenericId<"bucketFiles">
) {
  return LogoSet.make({
    logo: Option.getOrElse(yield* fileAddress(fileId), () => ""),
  });
});

/**
 * Sets the school's logo to a file it reserved and uploaded. A file of another school is refused as a file that is
 * not the school's to set. A file that is already the logo changes nothing. Once the new logo is set, the logo the
 * school held before is deleted.
 */
const set = FunctionImpl.make(
  databaseSchema,
  spec,
  "set",
  Effect.fn("tenancy.logo.set")(function* ({ fileId }) {
    const { person, tenant } = yield* Member;
    if (tenant.logo === fileId) {
      return yield* shownLogo(fileId);
    }
    const file = yield* (yield* DatabaseReader)
      .table("bucketFiles")
      .get(fileId)
      .pipe(Effect.option);
    if (Option.isNone(file) || file.value.tenantId !== tenant._id) {
      return LogoRefused.make({ reason: "file" });
    }
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("bucketFiles")
      .patch(fileId, { state: "stored" })
      .pipe(Effect.orDie);
    yield* writer
      .table("tenants")
      .replace(
        tenant._id,
        Struct.assign(Struct.omit(tenant, ["_creationTime", "_id"]), {
          logo: fileId,
        })
      )
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      type: "tenant.logo.set",
    });
    if (tenant.logo !== undefined) {
      yield* deleteFile(tenant.logo);
    }
    return yield* shownLogo(fileId);
  })
);

/** Removes the school's logo and deletes its file. A school with no logo changes nothing. */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("tenancy.logo.remove")(function* () {
    const { person, tenant } = yield* Member;
    if (tenant.logo === undefined) {
      return {};
    }
    yield* (yield* DatabaseWriter)
      .table("tenants")
      .replace(
        tenant._id,
        Struct.omit(tenant, ["_creationTime", "_id", "logo"])
      )
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      type: "tenant.logo.removed",
    });
    yield* deleteFile(tenant.logo);
    return {};
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(reserve),
  Layer.provide(set),
  Layer.provide(remove),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
