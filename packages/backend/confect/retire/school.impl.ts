import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  dropFile,
  dropFromAggregates,
  dropJob,
  nothing,
} from "@repo/backend/confect/retire/leftovers";
import spec from "@repo/backend/confect/retire/school.spec";
import type {
  Doc,
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
 * Rows one call handles when each row needs more than a delete or the rows
 * stay, so the call goes on from a cursor, and rows one dry call reads. A
 * document is at most 1 MiB, so 8 of them stay under the 16 MiB a transaction
 * may read, with no byte limit and so no partial page.
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
 * Tells whether a table holds a row. A call may paginate only once, so this
 * looks at the tables that come before the one it works on with a plain read.
 */
function hasRows(table: TableNames) {
  return Effect.gen(function* () {
    const ctx = yield* MutationCtx;
    return (yield* Effect.promise(() => ctx.db.query(table).first())) !== null;
  });
}

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
 * Clears the retired fields of a table that stays. `holds` says which rows
 * hold one, and `clear` removes them from a row. A row that holds one is
 * counted, and in a real pass it is cleared too. The rows stay, so a real page
 * goes on from the cursor of the page before, as a dry page does. The rows are
 * read and patched through the Convex context, never decoded.
 */
function fields<T extends TableNames>(
  table: T,
  holds: (row: Doc<T>) => boolean,
  clear: (row: Doc<T>) => Effect.Effect<void, never, MutationCtx>
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
        ctx.db.query(table).paginate({ cursor: page, numItems: PAGE_FEW })
      );
      const held = Arr.filter(read.page, holds);
      if (!dry) {
        yield* Effect.forEach(held, clear, { discard: true });
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
}

/**
 * The school fields of the deletion preparations, and the marker of the
 * cancellation batches that only school transfers made.
 */
const preparations = fields(
  "accountDeletionPreparations",
  (row) =>
    row.pendingSchoolId !== undefined ||
    row.pendingSchoolNextCursor !== undefined ||
    row.schoolCursor !== undefined ||
    row.successorCursor !== undefined ||
    row.cancellationStartedAt !== undefined,
  (row) =>
    Effect.flatMap(MutationCtx, (ctx) =>
      Effect.promise(() =>
        ctx.db.patch(row._id, {
          cancellationStartedAt: undefined,
          pendingSchoolId: undefined,
          pendingSchoolNextCursor: undefined,
          schoolCursor: undefined,
          successorCursor: undefined,
        })
      )
    )
);

/**
 * The link from a subscription to a school. Its `metadata` is a copy of what
 * Polar sends and every webhook writes it whole, so only the link is cleared.
 */
const subscriptions = fields(
  "subscriptions",
  (row) => row.schoolId !== undefined,
  (row) =>
    Effect.flatMap(MutationCtx, (ctx) =>
      Effect.promise(() => ctx.db.patch(row._id, { schoolId: undefined }))
    )
);

/**
 * The tables in the order their rows go: files and reactions first, then the
 * posts, forums, and groups they belong to, then classes, then schools. The
 * two tables that stay come last.
 */
const STEPS = Arr.map(
  [
    rows("schoolClassForumPostAttachments", (row, dry) =>
      dropFile(row.fileId, dry)
    ),
    rows("schoolClassForumPendingUploads", (row, dry) =>
      dropFile(row.storageId, dry)
    ),
    rows("schoolClassForumPostReactions"),
    rows("schoolClassForumReactions"),
    rows("schoolClassForumReadStates"),
    rows("schoolClassForumPosts", dropFromAggregates),
    rows("schoolClassForums"),
    rows("schoolClassMaterialGroups", (group, dry) =>
      dropJob(group.scheduledJobId, dry)
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
    subscriptions,
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
