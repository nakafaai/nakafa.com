import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import spec from "@repo/backend/confect/tenancy/logo.spec";
import { logoUrl } from "@repo/backend/confect/tenancy/profile";
import {
  LOGO_BYTE_LIMIT,
  LogoRefused,
  LogoSet,
} from "@repo/backend/confect/tenancy/schema";
import { Effect, Layer, Struct } from "effect";

/**
 * The address that a logo file is uploaded to. The upload answers with the
 * storage ID that `set` names.
 */
const uploadUrl = FunctionImpl.make(
  databaseSchema,
  spec,
  "uploadUrl",
  Effect.fn("tenancy.logo.uploadUrl")(function* () {
    return yield* (yield* StorageWriter).generateUploadUrl;
  })
);

/**
 * Sets the school's logo to an uploaded file. A file over the logo limit is
 * deleted and answered as refused, and nothing else changes. A file that is
 * already the logo changes nothing. Once the new logo is stored, the logo the
 * school held before is deleted.
 */
const set = FunctionImpl.make(
  databaseSchema,
  spec,
  "set",
  Effect.fn("tenancy.logo.set")(function* ({ storageId }) {
    const { person, tenant } = yield* Member;
    if (tenant.logo === storageId) {
      return LogoSet.make({ logo: yield* logoUrl(storageId) });
    }
    const storage = yield* StorageWriter;
    const file = yield* (yield* DatabaseReader)
      .table("_storage")
      .get(storageId)
      .pipe(Effect.orDie);
    if (file.size > LOGO_BYTE_LIMIT) {
      yield* storage.delete(storageId).pipe(Effect.orDie);
      return LogoRefused.make({ reason: "size" });
    }
    yield* (yield* DatabaseWriter)
      .table("tenants")
      .replace(
        tenant._id,
        Struct.assign(Struct.omit(tenant, ["_creationTime", "_id"]), {
          logo: storageId,
        })
      )
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      type: "tenant.logo.set",
    });
    if (tenant.logo !== undefined) {
      yield* storage.delete(tenant.logo).pipe(Effect.orDie);
    }
    return LogoSet.make({ logo: yield* logoUrl(storageId) });
  })
);

/**
 * Removes the school's logo and deletes its file. A school with no logo changes
 * nothing.
 */
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
    yield* (yield* StorageWriter).delete(tenant.logo).pipe(Effect.orDie);
    return {};
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(uploadUrl),
  Layer.provide(set),
  Layer.provide(remove),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
