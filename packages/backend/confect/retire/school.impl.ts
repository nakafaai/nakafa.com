import { FunctionImpl, GroupImpl } from "@confect/server";
import { TableAggregate } from "@convex-dev/aggregate";
import schema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/retire/school.spec";
import { components } from "@repo/backend/convex/_generated/api";
import type {
  DataModel,
  Doc,
  Id,
  TableNames,
} from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, Layer, Record as Rec, Schema } from "effect";

/**
 * Rows one real call removes from a table whose rows need no more than a
 * delete: 256 deletes are about 2 percent of the 16,000 documents a
 * transaction may write. Rows are read through `maximumBytesRead` below, so
 * their size cannot grow a page.
 */
const PAGE_ROWS = 256;

/**
 * Rows one call handles when each row needs more than a delete, and rows one
 * dry call reads. A document is at most 1 MiB, so 8 of them stay under the
 * 16 MiB a transaction may read, with no byte limit and so no partial page.
 */
const PAGE_FEW = 8;

/** Bytes a real page may read, a quarter of the 16 MiB a transaction may read. */
const PAGE_BYTES = 4 * 1024 * 1024;

/** The place a call starts: a table of the fixed order, and where to read in it. */
const Position = Schema.Struct({
  page: Schema.NullOr(Schema.String),
  step: Schema.Int,
});
const PositionText = Schema.fromJsonString(Position);

/**
 * The aggregate of forum posts by forum that the old post trigger kept. A post
 * leaves it here, with the same namespace and key it had when it went in.
 */
const forumPostsBySequence = new TableAggregate<{
  Namespace: Id<"schoolClassForums">;
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsBySequence, {
  namespace: (post) => post.forumId,
  sortKey: (post) => post.sequence,
});

/** The aggregate of forum posts by forum and author that the old trigger kept. */
const forumPostsByAuthorSequence = new TableAggregate<{
  Namespace: [Id<"schoolClassForums">, Id<"users">];
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsByAuthorSequence, {
  namespace: (post) => [post.forumId, post.createdBy],
  sortKey: (post) => post.sequence,
});

/** The nothing a row leaves behind when it is only a row. */
const nothing = Effect.succeed({ files: 0, jobs: 0 });

/** Deletes one stored file unless it is gone already, and counts it when it was there. */
const dropFile = Effect.fn("retire.school.dropFile")(function* (
  storageId: Id<"_storage">,
  dry: boolean
) {
  const ctx = yield* MutationCtx;
  const file = yield* Effect.promise(() => ctx.db.system.get(storageId));
  if (file === null) {
    return 0;
  }
  if (!dry) {
    yield* Effect.promise(() => ctx.storage.delete(storageId));
  }
  return 1;
});

/** Cancels a scheduled job that has not started, and counts it when it did. */
const dropJob = Effect.fn("retire.school.dropJob")(function* (
  jobId: Id<"_scheduled_functions"> | undefined,
  dry: boolean
) {
  if (jobId === undefined) {
    return 0;
  }
  const ctx = yield* MutationCtx;
  const job = yield* Effect.promise(() => ctx.db.system.get(jobId));
  if (job?.state.kind !== "pending") {
    return 0;
  }
  if (!dry) {
    yield* Effect.promise(() => ctx.scheduler.cancel(jobId));
  }
  return 1;
});

/**
 * Tells whether a table holds a row. A call may paginate only once, so this
 * looks at the tables that come before the one it works on with a plain read.
 */
function hasRows(table: TableNames) {
  return Effect.gen(function* () {
    const ctx = yield* MutationCtx;
    return (yield* Effect.promise(() => ctx.db.query(table).first())) !== null;
  });
}

/** Takes one forum post out of both forum aggregates, which may never have held it. */
const dropFromAggregates = Effect.fn("retire.school.dropFromAggregates")(
  function* (post: Doc<"schoolClassForumPosts">) {
    const ctx = yield* MutationCtx;
    yield* Effect.promise(() => forumPostsBySequence.deleteIfExists(ctx, post));
    yield* Effect.promise(() =>
      forumPostsByAuthorSequence.deleteIfExists(ctx, post)
    );
  }
);

/**
 * Deletes every row of one table, page by page. The rows are read and deleted
 * through the Convex context, never decoded: a row that does not decode must
 * not be able to keep itself in the table. A real page always starts at the
 * first row left, because the rows before it are gone; a dry page goes on from
 * the cursor of the page before. `leftovers` removes what a row owns outside
 * its table before the row goes, and counts it.
 */
function rows<T extends TableNames>(
  table: T,
  leftovers?: (
    row: Doc<T>,
    dry: boolean
  ) => Effect.Effect<Effect.Success<typeof nothing>, never, MutationCtx>
) {
  return {
    has: hasRows(table),
    table,
    run: Effect.fn(`retire.school.${table}`)(function* (
      page: string | null,
      dry: boolean
    ) {
      const ctx = yield* MutationCtx;
      const read = yield* Effect.promise(() =>
        ctx.db.query(table).paginate(
          dry
            ? { cursor: page, numItems: PAGE_FEW }
            : {
                cursor: null,
                maximumBytesRead: PAGE_BYTES,
                numItems: leftovers ? PAGE_FEW : PAGE_ROWS,
              }
        )
      );
      const owned = yield* Effect.forEach(read.page, (row) =>
        (leftovers?.(row, dry) ?? nothing).pipe(
          Effect.tap(() =>
            dry ? Effect.void : Effect.promise(() => ctx.db.delete(row._id))
          )
        )
      );
      return {
        done: read.isDone,
        files: Arr.reduce(owned, 0, (sum, one) => sum + one.files),
        jobs: Arr.reduce(owned, 0, (sum, one) => sum + one.jobs),
        resume: dry && !read.isDone ? read.continueCursor : null,
        rows: read.page.length,
      };
    }),
  };
}

/**
 * Clears the school fields of the deletion preparations that still hold them,
 * and the marker of the cancellation batches that only school transfers made.
 * The rows stay, so this step goes on from the cursor of the page before in a
 * real pass as well.
 */
const preparations = {
  has: hasRows("accountDeletionPreparations"),
  table: "accountDeletionPreparations",
  run: Effect.fn("retire.school.accountDeletionPreparations")(function* (
    page: string | null,
    dry: boolean
  ) {
    const ctx = yield* MutationCtx;
    const read = yield* Effect.promise(() =>
      ctx.db
        .query("accountDeletionPreparations")
        .paginate({ cursor: page, numItems: PAGE_FEW })
    );
    const held = Arr.filter(
      read.page,
      (row) =>
        row.pendingSchoolId !== undefined ||
        row.pendingSchoolNextCursor !== undefined ||
        row.schoolCursor !== undefined ||
        row.successorCursor !== undefined ||
        row.cancellationStartedAt !== undefined
    );
    if (!dry) {
      yield* Effect.forEach(
        held,
        (row) =>
          Effect.promise(() =>
            ctx.db.patch(row._id, {
              cancellationStartedAt: undefined,
              pendingSchoolId: undefined,
              pendingSchoolNextCursor: undefined,
              schoolCursor: undefined,
              successorCursor: undefined,
            })
          ),
        { discard: true }
      );
    }
    return {
      done: read.isDone,
      files: 0,
      jobs: 0,
      resume: read.isDone ? null : read.continueCursor,
      rows: held.length,
    };
  }),
};

/**
 * The tables in the order their rows go: files and reactions first, then the
 * posts, forums, and groups they belong to, then classes, then schools.
 */
const STEPS = Arr.map(
  [
    rows("schoolClassForumPostAttachments", (row, dry) =>
      Effect.map(dropFile(row.fileId, dry), (files) => ({ files, jobs: 0 }))
    ),
    rows("schoolClassForumPendingUploads", (row, dry) =>
      row.storageId === undefined
        ? nothing
        : Effect.map(dropFile(row.storageId, dry), (files) => ({
            files,
            jobs: 0,
          }))
    ),
    rows("schoolClassForumPostReactions"),
    rows("schoolClassForumReactions"),
    rows("schoolClassForumReadStates"),
    rows("schoolClassForumPosts", (post, dry) =>
      dry ? nothing : Effect.as(dropFromAggregates(post), { files: 0, jobs: 0 })
    ),
    rows("schoolClassForums"),
    rows("schoolClassMaterialGroups", (group, dry) =>
      Effect.map(dropJob(group.scheduledJobId, dry), (jobs) => ({
        files: 0,
        jobs,
      }))
    ),
    rows("schoolClassInviteCodes"),
    rows("schoolClassMembers"),
    rows("schoolClasses"),
    rows("schoolInviteCodes"),
    rows("schoolActivityLogs"),
    rows("schoolMembers"),
    rows("schools"),
    rows("accountDeletionSchoolTransfers"),
    preparations,
  ],
  (step, index) => ({ ...step, index })
);

const erase = FunctionImpl.make(
  schema,
  spec,
  "erase",
  Effect.fn("retire.school.erase")(function* ({ cursor, dry }) {
    const position =
      cursor === null
        ? { page: null, step: 0 }
        : yield* Schema.decodeEffect(PositionText)(cursor).pipe(Effect.orDie);
    for (const current of Arr.drop(STEPS, position.step)) {
      // A table that a cursor names has rows left, so only the others need a look.
      const resumed = current.index === position.step && position.page !== null;
      if (!(resumed || (yield* current.has))) {
        continue;
      }
      const result = yield* current.run(resumed ? position.page : null, dry);
      const more = result.done
        ? { page: null, step: current.index + 1 }
        : { page: result.resume, step: current.index };
      return {
        files: result.files,
        jobs: result.jobs,
        next:
          more.step < STEPS.length
            ? yield* Schema.encodeEffect(PositionText)(more).pipe(Effect.orDie)
            : null,
        rows: Rec.singleton(current.table, result.rows),
      };
    }
    return { files: 0, jobs: 0, next: null, rows: {} };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(erase),
  GroupImpl.finalize
);
