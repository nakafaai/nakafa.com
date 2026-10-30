import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomPostsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  classAccess,
  classAuthority,
} from "@repo/backend/confect/classroom/authority";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { postField } from "@repo/backend/confect/classroom/posts/post";
import spec from "@repo/backend/confect/classroom/posts.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Option,
  Struct,
} from "effect";

/** An announcement that is not the allowed class's own, or not the caller's, refused as a missing object. */
const missing = () =>
  new AccessDenied({ action: "post.publish", reason: "resource" });

/** The caller's own announcement of the allowed class. */
const ownPost = Effect.fn("classroom.posts.own")(function* (
  postId: GenericId.GenericId<"classroomPosts">
) {
  const { person } = yield* Member;
  const row = yield* Class;
  const post = yield* (yield* DatabaseReader)
    .table("classroomPosts")
    .get(postId)
    .pipe(Effect.option);
  if (
    Option.isNone(post) ||
    post.value.classId !== row._id ||
    post.value.authorId !== person._id
  ) {
    return yield* missing();
  }
  return post.value;
});

/** The views of some announcements for the viewer: each text opened with the school key, each author's name read once. */
const postViews = Effect.fn("classroom.posts.views")(function* (
  rows: readonly ClassroomPostsDoc[]
) {
  const { person } = yield* Member;
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const keys = yield* schoolKeys(row.tenantId);
  const authors = yield* Effect.forEach(
    Arr.dedupe(Arr.map(rows, (post) => post.authorId)),
    (authorId) => reader.table("tenantPeople").get(authorId),
    { concurrency: "unbounded" }
  ).pipe(Effect.orDie);
  return yield* Effect.forEach(rows, (post) =>
    Effect.gen(function* () {
      // Every author was read above, so a post without its author is a defect.
      const author = yield* Effect.fromOption(
        Arr.findFirst(authors, (candidate) => candidate._id === post.authorId)
      );
      return {
        author: { id: post.authorId, name: author.name },
        clientKey: post.clientKey,
        createdAt: post.createdAt,
        editedAt: post.editedAt ?? null,
        email: post.email,
        id: post._id,
        mine: post.authorId === person._id,
        text: yield* openText(keys, postField(post), post.sealedText),
      };
    }).pipe(Effect.orDie)
  );
});

/** The view of one announcement for the viewer. */
const postView = (row: ClassroomPostsDoc) =>
  Effect.map(postViews([row]), (views) => Arr.getUnsafe(views, 0));

/** One page of the class's announcements, newest first, indexed by class and bounded by the page size. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.posts.list")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const found = yield* (yield* DatabaseReader)
      .table("classroomPosts")
      .index("by_classId", (query) => query.eq("classId", row._id), "desc")
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(found, { page: yield* postViews(found.page) });
  })
);

/**
 * Posts an announcement to the class, sealed with the school key, records
 * `announcement.posted`, the published change, and schedules the fan-out that
 * writes the inbox row of every member of the class in batches (ADR 0027); Convex
 * schedules it only if the post commits. A repeat of a client key of the class answers that announcement and
 * writes nothing; whoever posts in the class may read it anyway.
 */
const publish = FunctionImpl.make(
  databaseSchema,
  spec,
  "publish",
  Effect.fn("classroom.posts.publish")(function* ({ clientKey, email, text }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const sent = yield* reader
      .table("classroomPosts")
      .index("by_classId_and_clientKey", (query) =>
        query.eq("classId", row._id).eq("clientKey", clientKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sent)) {
      return yield* postView(sent.value);
    }
    const fields = { classId: row._id, clientKey };
    const postId = yield* (yield* DatabaseWriter)
      .table("classroomPosts")
      .insert({
        ...fields,
        authorId: person._id,
        createdAt: yield* Clock.currentTimeMillis,
        email,
        sealedText: yield* sealText(
          yield* schoolKeys(row.tenantId),
          postField(fields),
          text
        ).pipe(Effect.orDie),
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), row, {
      post: postId,
      type: "announcement.posted",
    });
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.notifications.fanout.run,
      { cursor: null, phase: "students", source: { _tag: "post", postId } }
    );
    return yield* postView(
      yield* reader.table("classroomPosts").get(postId).pipe(Effect.orDie)
    );
  })
);

/** Changes the text of the teacher's own announcement. */
const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("classroom.posts.edit")(function* ({ postId, text }) {
    const row = yield* Class;
    const post = yield* ownPost(postId);
    const edited = Struct.assign(post, {
      editedAt: yield* Clock.currentTimeMillis,
      sealedText: yield* sealText(
        yield* schoolKeys(row.tenantId),
        postField(post),
        text
      ).pipe(Effect.orDie),
    });
    yield* (yield* DatabaseWriter)
      .table("classroomPosts")
      .replace(post._id, Struct.omit(edited, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    return yield* postView(edited);
  })
);

/** Removes the teacher's own announcement for good. */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("classroom.posts.remove")(function* ({ postId }) {
    const post = yield* ownPost(postId);
    yield* (yield* DatabaseWriter)
      .table("classroomPosts")
      .delete(post._id)
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(publish),
  Layer.provide(edit),
  Layer.provide(remove),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
