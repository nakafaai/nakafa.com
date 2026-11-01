import { FunctionImpl, GroupImpl } from "@confect/server";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  Scheduler,
  StorageActionWriter,
} from "@repo/backend/confect/_generated/services";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { dropPassages } from "@repo/backend/confect/classroom/library/drop";
import { libraryField } from "@repo/backend/confect/classroom/library/item";
import {
  MAX_READ_BYTES,
  passageField,
  passagesOf,
  READ_INSTRUCTIONS,
} from "@repo/backend/confect/classroom/passages";
import spec from "@repo/backend/confect/classroom/passages.spec";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { generateText } from "ai";
import { Array as Arr, Duration, Effect, Layer } from "effect";

/** Rows one clearing or rebuilding run reads. */
const BATCH = 100;

/** Reads what a build needs of a file. A link, a file too large to read, and a school with Nina off give nothing. */
const source = FunctionImpl.make(
  databaseSchema,
  spec,
  "source",
  Effect.fn("classroom.passages.source")(function* ({ itemId }) {
    const reader = yield* DatabaseReader;
    const item = yield* reader
      .table("classroomLibrary")
      .get(itemId)
      .pipe(Effect.orDie);
    const tenant = yield* reader
      .table("tenants")
      .get(item.tenantId)
      .pipe(Effect.orDie);
    if (
      item.kind !== "file" ||
      item.byteSize > MAX_READ_BYTES ||
      !tenant.policies.nina
    ) {
      return null;
    }
    return { contentType: item.contentType, storageId: item.storageId };
  })
);

/** The text of a file as the model reads it, or nothing when the call fails, which leaves the file out of the index. */
const textOf = (file: Blob, contentType: string) =>
  Effect.gen(function* () {
    const reader = (yield* Gateway).language("import");
    const data = new Uint8Array(
      yield* Effect.promise(() => file.arrayBuffer())
    );
    const { text } = yield* Effect.tryPromise((signal) =>
      generateText({
        abortSignal: signal,
        messages: [
          {
            content: [{ data, mediaType: contentType, type: "file" }],
            role: "user",
          },
        ],
        model: reader.model,
        system: READ_INSTRUCTIONS,
        timeout: reader.timeout,
      })
    );
    return text;
  }).pipe(
    Effect.provide(GatewayLive),
    Effect.orElseSucceed(() => "")
  );

/** Embeds a file's passages, or answers none when the call fails. */
const embedded = (passages: readonly string[]) =>
  Effect.gen(function* () {
    const vectors = yield* (yield* Gateway).embed(passages);
    return Arr.zipWith(passages, vectors, (text, embedding) => ({
      embedding,
      text,
    }));
  }).pipe(
    Effect.provide(GatewayLive),
    Effect.orElseSucceed(() => [])
  );

/** Reads one file, cuts it into passages, embeds them, and stores them, outside any transaction but the last. */
const build = FunctionImpl.make(
  databaseSchema,
  spec,
  "build",
  Effect.fn("classroom.passages.build")(function* ({ itemId }) {
    const { runQuery } = yield* QueryRunner;
    const found = yield* runQuery(classroomInternal.passages.source, {
      itemId,
    }).pipe(Effect.orDie);
    if (found === null) {
      return null;
    }
    const file = yield* (yield* StorageActionWriter)
      .get(found.storageId)
      .pipe(Effect.orDie);
    const passages = passagesOf(yield* textOf(file, found.contentType));
    if (Arr.isReadonlyArrayEmpty(passages)) {
      return null;
    }
    const { runMutation } = yield* MutationRunner;
    yield* runMutation(classroomInternal.passages.store, {
      itemId,
      passages: yield* embedded(passages),
    }).pipe(Effect.orDie);
    return null;
  })
);

/** Replaces a file's passages, each sealed with the school key beside its vector. */
const store = FunctionImpl.make(
  databaseSchema,
  spec,
  "store",
  Effect.fn("classroom.passages.store")(function* ({ itemId, passages }) {
    const item = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .get(itemId)
      .pipe(Effect.orDie);
    yield* dropPassages(itemId);
    const keys = yield* schoolKeys(item.tenantId);
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      passages,
      ({ embedding, text }, ordinal) =>
        Effect.gen(function* () {
          yield* writer.table("classroomPassages").insert({
            classId: item.classId,
            embedding,
            itemId,
            ordinal,
            sealedText: yield* sealText(
              keys,
              passageField({ itemId, ordinal }),
              text
            ),
            tenantId: item.tenantId,
          });
        }),
      { discard: true }
    ).pipe(Effect.orDie);
    return null;
  })
);

/** Deletes a page of a school's passages when it turns Nina off, and runs again until none is left. */
const clear = FunctionImpl.make(
  databaseSchema,
  spec,
  "clear",
  Effect.fn("classroom.passages.clear")(function* ({ tenantId }) {
    const rows = yield* (yield* DatabaseReader)
      .table("classroomPassages")
      .index("by_tenantId", (query) => query.eq("tenantId", tenantId))
      .take(BATCH)
      .pipe(Effect.orDie);
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      rows,
      (row) => writer.table("classroomPassages").delete(row._id),
      { discard: true }
    ).pipe(Effect.orDie);
    if (rows.length === BATCH) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        classroomInternal.passages.clear,
        { tenantId }
      );
    }
    return null;
  })
);

/** Schedules a build of each file of a school when it turns Nina on, one page per run. */
const rebuild = FunctionImpl.make(
  databaseSchema,
  spec,
  "rebuild",
  Effect.fn("classroom.passages.rebuild")(function* ({ cursor, tenantId }) {
    const page = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .index("by_tenantId", (query) => query.eq("tenantId", tenantId))
      .paginate({ cursor, numItems: BATCH })
      .pipe(Effect.orDie);
    const scheduler = yield* Scheduler;
    yield* Effect.forEach(
      page.page,
      (item) =>
        scheduler.runAfter(Duration.zero, classroomInternal.passages.build, {
          itemId: item._id,
        }),
      { discard: true }
    );
    if (!page.isDone) {
      yield* scheduler.runAfter(
        Duration.zero,
        classroomInternal.passages.rebuild,
        { cursor: page.continueCursor, tenantId }
      );
    }
    return null;
  })
);

/** Opens the passages a search found, each with its file's title. */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("classroom.passages.open")(function* ({ ids }) {
    const reader = yield* DatabaseReader;
    return yield* Effect.forEach(ids, (id) =>
      Effect.gen(function* () {
        const row = yield* reader.table("classroomPassages").get(id);
        const item = yield* reader.table("classroomLibrary").get(row.itemId);
        const keys = yield* schoolKeys(row.tenantId);
        return {
          text: yield* openText(keys, passageField(row), row.sealedText),
          title: yield* openText(
            keys,
            libraryField(item, "sealedTitle"),
            item.sealedTitle
          ),
        };
      }).pipe(Effect.orDie)
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(source),
  Layer.provide(build),
  Layer.provide(store),
  Layer.provide(clear),
  Layer.provide(rebuild),
  Layer.provide(open),
  GroupImpl.finalize
);
