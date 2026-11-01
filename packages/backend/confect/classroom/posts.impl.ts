import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomPostsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { PinLimit } from "@repo/backend/confect/classroom/errors";
import { VoteRefused } from "@repo/backend/confect/classroom/forum/errors";
import { castVote } from "@repo/backend/confect/classroom/forum/tally";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { announce } from "@repo/backend/confect/classroom/posts/announce";
import {
  postPollView,
  sealPostPoll,
} from "@repo/backend/confect/classroom/posts/poll";
import {
  PIN_LIMIT,
  postField,
} from "@repo/backend/confect/classroom/posts/post";
import spec from "@repo/backend/confect/classroom/posts.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

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
        pinned: post.pinnedAt !== undefined,
        poll: yield* postPollView(keys, post),
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

/** The class's pinned announcements, most lately pinned first, bounded by how many a class keeps. */
const pinnedPosts = Effect.fn("classroom.posts.pinnedPosts")(function* () {
  const row = yield* Class;
  return yield* (yield* DatabaseReader)
    .table("classroomPosts")
    .index(
      "by_classId_and_pinnedAt",
      (query) => query.eq("classId", row._id).gt("pinnedAt", 0),
      "desc"
    )
    .take(PIN_LIMIT)
    .pipe(Effect.orDie);
});

/** What the class home keeps at its top. */
const pinned = FunctionImpl.make(
  databaseSchema,
  spec,
  "pinned",
  Effect.fn("classroom.posts.pinned")(function* () {
    return yield* postViews(yield* pinnedPosts());
  })
);

/**
 * Pins an announcement of the class to the top of its home, whoever wrote it, or takes it down. A class that keeps the
 * most it can refuses another, and pinning one that stands changes nothing.
 */
const pin = FunctionImpl.make(
  databaseSchema,
  spec,
  "pin",
  Effect.fn("classroom.posts.pin")(function* ({ pinned: wanted, postId }) {
    const row = yield* Class;
    const post = yield* (yield* DatabaseReader)
      .table("classroomPosts")
      .get(postId)
      .pipe(Effect.option);
    if (Option.isNone(post) || post.value.classId !== row._id) {
      return yield* missing();
    }
    if (wanted === (post.value.pinnedAt !== undefined)) {
      return null;
    }
    if (wanted && (yield* pinnedPosts()).length >= PIN_LIMIT) {
      return yield* new PinLimit();
    }
    yield* (yield* DatabaseWriter)
      .table("classroomPosts")
      .patch(postId, {
        pinnedAt: wanted ? yield* Clock.currentTimeMillis : undefined,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/**
 * Posts an announcement to the class, sealed with the school key (`announce`). A repeat of a client key of the class answers that announcement and
 * writes nothing; whoever posts in the class may read it anyway.
 */
const publish = FunctionImpl.make(
  databaseSchema,
  spec,
  "publish",
  Effect.fn("classroom.posts.publish")(function* ({
    clientKey,
    email,
    poll,
    text,
  }) {
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
    const keys = yield* schoolKeys(row.tenantId);
    const postId = yield* announce(row, person, {
      clientKey,
      email,
      ...(poll === null
        ? {}
        : { poll: yield* sealPostPoll(keys, fields, poll) }),
      sealedText: yield* sealText(keys, postField(fields), text).pipe(
        Effect.orDie
      ),
    });
    return yield* postView(
      yield* reader.table("classroomPosts").get(postId).pipe(Effect.orDie)
    );
  })
);

/** The votes row of an announcement, if anyone voted. */
const votesOf = Effect.fn("classroom.posts.votesOf")(function* (
  postId: GenericId.GenericId<"classroomPosts">
) {
  return yield* (yield* DatabaseReader)
    .table("classroomPostVotes")
    .index("by_postId", (query) => query.eq("postId", postId))
    .first()
    .pipe(Effect.orDie);
});

/** The votes of some announcements of the class for the viewer, read apart so a page of posts stays still while a class votes. */
const votes = FunctionImpl.make(
  databaseSchema,
  spec,
  "votes",
  Effect.fn("classroom.posts.votes")(function* ({ postIds }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const rows = yield* Effect.forEach(postIds, votesOf);
    return Arr.map(
      Arr.filter(Arr.getSomes(rows), (found) => found.classId === row._id),
      (found) => ({
        postId: found.postId,
        votes: Arr.map(found.votes, ({ option, people }) => ({
          count: people.length,
          mine: Arr.contains(people, person._id),
          option,
        })),
      })
    );
  })
);

/** Sets the viewer's choices in the poll of an announcement. No choice takes their vote back. */
const vote = FunctionImpl.make(
  databaseSchema,
  spec,
  "vote",
  Effect.fn("classroom.posts.vote")(function* ({ options, postId }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const post = yield* (yield* DatabaseReader)
      .table("classroomPosts")
      .get(postId)
      .pipe(Effect.option);
    if (
      Option.isNone(post) ||
      post.value.classId !== row._id ||
      post.value.poll === undefined
    ) {
      return yield* new AccessDenied({
        action: "forum.post",
        reason: "resource",
      });
    }
    const { poll } = post.value;
    const chosen = Arr.dedupe(options);
    const held = poll.sealedOptions.length;
    if (
      Arr.some(chosen, (option) => option < 0 || option >= held) ||
      (!poll.multiple && chosen.length > 1)
    ) {
      return yield* new VoteRefused();
    }
    const stored = yield* votesOf(postId);
    const writer = (yield* DatabaseWriter).table("classroomPostVotes");
    if (Option.isSome(stored)) {
      yield* writer
        .patch(stored.value._id, {
          votes: castVote(stored.value.votes, chosen, person._id),
        })
        .pipe(Effect.orDie);
      return null;
    }
    yield* writer
      .insert({
        classId: row._id,
        postId,
        tenantId: row.tenantId,
        votes: castVote([], chosen, person._id),
      })
      .pipe(Effect.orDie);
    return null;
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

/** Removes the teacher's own announcement for good, with the votes of its poll. */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("classroom.posts.remove")(function* ({ postId }) {
    const post = yield* ownPost(postId);
    const writer = yield* DatabaseWriter;
    const stored = yield* votesOf(post._id);
    if (Option.isSome(stored)) {
      yield* writer
        .table("classroomPostVotes")
        .delete(stored.value._id)
        .pipe(Effect.orDie);
    }
    yield* writer.table("classroomPosts").delete(post._id).pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(pinned),
  Layer.provide(pin),
  Layer.provide(votes),
  Layer.provide(vote),
  Layer.provide(publish),
  Layer.provide(edit),
  Layer.provide(remove),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
