import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  StorageActionWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import {
  FileSizeRefused,
  FileTypeRefused,
} from "@repo/backend/confect/classroom/errors";
import type { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import {
  fileTypeOf,
  HEAD_BYTES,
  LIBRARY_BYTE_LIMIT,
} from "@repo/backend/confect/classroom/library/file";
import { libraryField } from "@repo/backend/confect/classroom/library/item";
import { libraryViews } from "@repo/backend/confect/classroom/library/views";
import spec from "@repo/backend/confect/classroom/library.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { sealText } from "@repo/backend/confect/vault/text";
import {
  Array as Arr,
  Clock,
  Effect,
  Layer,
  Match,
  Option,
  Struct,
} from "effect";

/** The ID of an uploaded file in Convex storage. */
const storageIdSchema = Id("_storage");
type StorageId = typeof storageIdSchema.Type;

/** One page of the class library, the newest item first. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.library.list")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const found = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .index("by_classId", (query) => query.eq("classId", row._id), "desc")
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(found, { page: yield* libraryViews(found.page) });
  })
);

/** The item of the allowed class that a client key created, if one did. */
const sentWith = Effect.fn("classroom.library.sentWith")(function* (
  classId: GenericId.GenericId<"classes">,
  clientKey: typeof ClientKey.Type
) {
  return yield* (yield* DatabaseReader)
    .table("classroomLibrary")
    .index("by_classId_and_clientKey", (query) =>
      query.eq("classId", classId).eq("clientKey", clientKey)
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * Adds a link to the library, its title and its address sealed with the school
 * key. A repeat of a client key of the class answers that item and writes
 * nothing.
 */
const addLink = FunctionImpl.make(
  databaseSchema,
  spec,
  "addLink",
  Effect.fn("classroom.library.addLink")(function* ({
    address,
    clientKey,
    title,
  }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const sent = yield* sentWith(row._id, clientKey);
    if (Option.isSome(sent)) {
      return Arr.getUnsafe(yield* libraryViews([sent.value]), 0);
    }
    const keys = yield* schoolKeys(row.tenantId);
    const fields = { classId: row._id, clientKey };
    const itemId = yield* (yield* DatabaseWriter)
      .table("classroomLibrary")
      .insert({
        ...fields,
        authorId: person._id,
        createdAt: yield* Clock.currentTimeMillis,
        kind: "link",
        sealedAddress: yield* sealText(
          keys,
          libraryField(fields, "sealedAddress"),
          address
        ).pipe(Effect.orDie),
        sealedTitle: yield* sealText(
          keys,
          libraryField(fields, "sealedTitle"),
          title
        ).pipe(Effect.orDie),
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    const item = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .get(itemId)
      .pipe(Effect.orDie);
    return Arr.getUnsafe(yield* libraryViews([item]), 0);
  })
);

/** The address that a file of the library is uploaded to. The upload answers with the storage ID that `register` names. */
const uploadUrl = FunctionImpl.make(
  databaseSchema,
  spec,
  "uploadUrl",
  Effect.fn("classroom.library.uploadUrl")(function* () {
    return yield* (yield* StorageWriter).generateUploadUrl;
  })
);

/** The caller's Person in the school, once the middleware of the function allowed it to add to the library. */
const canAdd = FunctionImpl.make(
  databaseSchema,
  spec,
  "canAdd",
  Effect.fn("classroom.library.canAdd")(function* () {
    const { person } = yield* Member;
    return { authorId: person._id };
  })
);

/** Deletes an uploaded file that the server refuses, so a refused file is never stored. */
const refuse = (storageId: StorageId) =>
  Effect.gen(function* () {
    const { runMutation } = yield* MutationRunner;
    yield* runMutation(refs.internal.exams.assets.discard, { storageId });
  });

/**
 * Registers an uploaded file as an item of the library. The right to add is
 * checked first, then the file's size against the limit, before its bytes are
 * read. The leading bytes name the file's type, which the library keeps only as
 * a PDF or an image. A file that passes is stored as an item; a file that does
 * not is deleted, and the refusal names why.
 */
const register = FunctionImpl.make(
  databaseSchema,
  spec,
  "register",
  Effect.fn("classroom.library.register")(
    function* ({ classId, clientKey, slug, storageId, title }) {
      yield* requireAuth();
      const { runQuery } = yield* QueryRunner;
      const { authorId } = yield* runQuery(
        refs.public.classroom.library.canAdd,
        { classId, slug }
      ).pipe(
        Effect.catchTag("NotMember", () =>
          Effect.fail(
            new AccessDenied({ action: "library.manage", reason: "role" })
          )
        )
      );
      const { size } = yield* runQuery(refs.internal.exams.assets.stored, {
        storageId,
      }).pipe(Effect.orDie);
      if (size > LIBRARY_BYTE_LIMIT) {
        yield* refuse(storageId);
        return yield* new FileSizeRefused();
      }
      const blob = yield* (yield* StorageActionWriter)
        .get(storageId)
        .pipe(Effect.orDie);
      const head = new Uint8Array(
        yield* Effect.promise(() => blob.slice(0, HEAD_BYTES).arrayBuffer())
      );
      return yield* Option.match(fileTypeOf(head), {
        onNone: () =>
          refuse(storageId).pipe(
            Effect.andThen(Effect.fail(new FileTypeRefused()))
          ),
        onSome: (contentType) =>
          Effect.gen(function* () {
            const { runMutation } = yield* MutationRunner;
            return yield* runMutation(refs.internal.classroom.library.commit, {
              authorId,
              byteSize: size,
              classId,
              clientKey,
              contentType,
              storageId,
              title,
            });
          }),
      });
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/**
 * Stores the row of a registered file in the class's school, its title sealed
 * with the school key. A repeat of a client key of the class keeps the item it
 * made and deletes the file of the repeat.
 */
const commit = FunctionImpl.make(
  databaseSchema,
  spec,
  "commit",
  Effect.fn("classroom.library.commit")(function* (args) {
    const sent = yield* sentWith(args.classId, args.clientKey);
    if (Option.isSome(sent)) {
      yield* (yield* StorageWriter).delete(args.storageId).pipe(Effect.orDie);
      return { id: sent.value._id };
    }
    const row = yield* (yield* DatabaseReader)
      .table("classes")
      .get(args.classId)
      .pipe(Effect.orDie);
    const fields = { classId: row._id, clientKey: args.clientKey };
    const id = yield* (yield* DatabaseWriter)
      .table("classroomLibrary")
      .insert({
        ...fields,
        authorId: args.authorId,
        byteSize: args.byteSize,
        contentType: args.contentType,
        createdAt: yield* Clock.currentTimeMillis,
        kind: "file",
        sealedTitle: yield* sealText(
          yield* schoolKeys(row.tenantId),
          libraryField(fields, "sealedTitle"),
          args.title
        ).pipe(Effect.orDie),
        storageId: args.storageId,
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    return { id };
  })
);

/**
 * Removes an item of the allowed class, and deletes its file, which revokes the
 * file's address (ADR 0028). An item of another class is refused as a missing
 * object.
 */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("classroom.library.remove")(function* ({ itemId }) {
    const row = yield* Class;
    const item = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .get(itemId)
      .pipe(Effect.option);
    if (Option.isNone(item) || item.value.classId !== row._id) {
      return yield* new AccessDenied({
        action: "library.manage",
        reason: "resource",
      });
    }
    const storage = yield* StorageWriter;
    yield* Match.value(item.value).pipe(
      Match.discriminatorsExhaustive("kind")({
        file: (file) => storage.delete(file.storageId).pipe(Effect.orDie),
        link: () => Effect.void,
      })
    );
    yield* (yield* DatabaseWriter)
      .table("classroomLibrary")
      .delete(itemId)
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(addLink),
  Layer.provide(uploadUrl),
  Layer.provide(canAdd),
  Layer.provide(register),
  Layer.provide(commit),
  Layer.provide(remove),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
